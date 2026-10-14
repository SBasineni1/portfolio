import type { AboutPhoto } from '../content';
import { el, loadLater } from './dom';
import { EASE_SETTLE, gsap } from './motion';

/**
 * The About photos as a stack of full-bleed photo cards (the Polaroid is kept
 * for the hero portrait). Throw the top print and it flies off the way it was
 * flicked, slowing, tumbling and receding into the sky. It rejoins the bottom
 * of the stack and the next print is on top.
 *
 * Drag and release (or tap) throws; a weak drag springs back. Keyboards throw
 * with Enter, Space or the arrow keys. Under reduced motion a throw is a
 * plain crossfade to the next print.
 */

/** Seconds from release until a print has gone and rejoins the stack. */
const FLIGHT = 1.35;
/** Release speed, px/s, that counts as a throw... */
const THROW_SPEED = 650;
/** ...or drag distance, as a fraction of the print's width. */
const THROW_REACH = 0.42;
/** A throw that cleared on reach alone still leaves the hand this fast. */
const MIN_SPEED = 900;
/** Air drag on a print in flight, 1/s. */
const DRAG = 1.1;
/** The readout's name for a throw, by release speed (px/s). */
const THROWS: [number, string][] = [
  [1200, 'Soft toss'],
  [2400, 'Good throw'],
  [4000, 'Strong throw'],
  [10000, 'Fastball'],
  [15000, 'Ultra fastball'],
  [Infinity, 'Record-breaking!'],
];
/** A tap or key press throws this hard. */
const TOSS = { vx: 1350, vy: -260 };

interface Print {
  el: HTMLElement;
  photo: AboutPhoto;
}

interface Flight {
  print: Print;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  age: number;
  /** Tumble phase, so prints thrown together do not flutter in step. */
  phase: number;
}

interface Drag {
  id: number;
  x0: number;
  y0: number;
  t0: number;
  samples: { x: number; y: number; t: number }[];
}

/** Above this mean luminance (0..1) the scene behind the readout counts as light. */
const LIGHT_BACKDROP = 0.5;
/** How often to re-read the scene behind the readout while it is on screen, ms. */
const BACKDROP_EVERY = 700;

/**
 * Mean relative luminance of the painted sky and terrain behind `rect`, or
 * -1 if it cannot be read. One small readback, a couple of times a second.
 */
function backdropLuminance(rect: DOMRect): number {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas#sky');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || rect.width === 0) return -1;
  const box = canvas.getBoundingClientRect();
  const scale = canvas.width / box.width;
  const x = Math.max(0, Math.round((rect.left - box.left) * scale));
  const y = Math.max(0, Math.round((rect.top - box.top) * scale));
  const w = Math.min(canvas.width - x, Math.round(rect.width * scale));
  const h = Math.min(canvas.height - y, Math.round(rect.height * scale));
  if (w <= 0 || h <= 0) return -1;
  const data = ctx.getImageData(x, y, w, h).data;
  // Every 8th pixel is plenty for an average.
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 32) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n++;
  }
  return n > 0 ? sum / n : -1;
}

/**
 * Resting angle of each place in the stack, degrees, top first: a gentle fan
 * so two cards show at the edges underneath. Deeper cards sit squared up in
 * the last place, hidden, so the edge stays tidy. A card takes the angle of
 * whatever place it moves into.
 */
const SLOT_TILTS = [-1.5, 2.5, -3];

/** Resting offset and angle of the print `depth` cards down from the top. */
function slot(depth: number) {
  const place = Math.min(depth, SLOT_TILTS.length - 1);
  return { x: place * 1.5, y: place * 2, rotation: SLOT_TILTS[place] };
}

export function photoStack(photos: AboutPhoto[], reduced: () => boolean): HTMLElement {
  const root = el('div', 'snaps');
  if (photos.length === 0) return root;
  root.tabIndex = 0;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-roledescription', 'photo stack');
  root.setAttribute('aria-label', 'Photos. Press Enter or an arrow key to throw the top photo.');

  const deck = el('div', 'snaps__deck');
  const readout = el('div', 'snaps__readout', 'Throw a photo ↗');
  readout.setAttribute('aria-hidden', 'true');
  const status = el('span', 'snaps__status');
  status.setAttribute('aria-live', 'polite');
  root.append(deck, readout, status);

  const prints: Print[] = photos.map((photo, index) => {
    const card = el('figure', 'snap');
    const frame = el('div', 'snap__photo');
    const img = el('img');
    loadLater(img, photo.src);
    img.alt = photo.alt;
    img.width = 960;
    img.height = 720;
    img.decoding = 'async';
    img.loading = index < 2 ? 'eager' : 'lazy';
    img.draggable = false;
    frame.append(img);
    card.append(frame);
    if (photo.caption) card.append(el('figcaption', 'snap__caption', photo.caption));
    deck.append(card);
    return { el: card, photo };
  });

  /** Top first. A print in flight is in neither this nor its old place. */
  const order = [...prints];
  const flights: Flight[] = [];
  let drag: Drag | null = null;
  let frame = 0;
  let last = 0;

  const top = (): Print | undefined => order[0];

  const describe = (): void => {
    const print = top();
    if (!print) return;
    status.textContent = `Photo ${prints.indexOf(print) + 1} of ${prints.length}: ${print.photo.alt}`;
  };

  /** Settle every waiting print into its slot; only the top one is live. */
  const restack = (animate: boolean): void => {
    order.forEach((print, depth) => {
      const { x, y, rotation } = slot(depth);
      const isTop = depth === 0;
      print.el.classList.toggle('is-top', isTop);
      print.el.setAttribute('aria-hidden', String(!isTop));
      const vars = { x, y, rotation, scale: 1, zIndex: order.length - depth };
      if (animate) gsap.to(print.el, { ...vars, duration: 0.5, ease: EASE_SETTLE, overwrite: 'auto' });
      else gsap.set(print.el, vars);
    });
  };

  const show = (speed: number): void => {
    const name = THROWS.find(([limit]) => speed < limit)?.[1] ?? 'Record-breaking!';
    readout.textContent = `${name}, ${Math.round(speed).toLocaleString('en-US')} px/s`;
  };

  // The number runs up from zero in the same short time for every throw, so
  // it climbs as fast as the print left the hand: a fastball spins it.
  const shown = { speed: 0 };
  const report = (speed: number): void => {
    gsap.killTweensOf(shown);
    if (reduced()) {
      show(speed);
      return;
    }
    gsap.fromTo(
      shown,
      { speed: 0 },
      { speed, duration: 0.55, ease: 'power3.out', onUpdate: () => show(shown.speed) },
    );
  };

  /** The print has gone: back in at the bottom of the stack. */
  const rejoin = (print: Print): void => {
    order.push(print);
    const { x, y, rotation } = slot(order.length - 1);
    gsap.set(print.el, {
      x,
      y,
      rotation,
      rotationX: 0,
      rotationY: 0,
      scale: 1,
      zIndex: 0,
    });
    gsap.to(print.el, { opacity: 1, duration: 0.4, ease: 'none' });
    restack(true);
  };

  const step = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const drag = Math.exp(-DRAG * dt);
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.age += dt;
      f.vx *= drag;
      f.vy *= drag;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.spin *= drag;
      f.rotation += f.spin * dt;
      const p = Math.min(1, f.age / FLIGHT);
      const tumble = Math.min(1, f.age * 2.5);
      gsap.set(f.print.el, {
        x: f.x,
        y: f.y,
        rotation: f.rotation,
        rotationX: Math.sin(f.age * 6.3 + f.phase) * 34 * tumble,
        rotationY: Math.cos(f.age * 4.1 + f.phase) * 26 * tumble,
        scale: 1 - 0.5 * p * p,
        opacity: p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6,
      });
      if (p >= 1) {
        flights.splice(i, 1);
        rejoin(f.print);
      }
    }
    frame = flights.length > 0 ? requestAnimationFrame(step) : 0;
  };

  const throwTop = (vx: number, vy: number, fromX: number, fromY: number): void => {
    const print = order.shift();
    if (!print) return;
    gsap.killTweensOf(print.el);
    print.el.classList.remove('is-top');
    print.el.setAttribute('aria-hidden', 'true');
    report(Math.hypot(vx, vy));

    restack(true);
    describe();

    if (reduced()) {
      gsap.to(print.el, { opacity: 0, duration: 0.25, ease: 'none', onComplete: () => rejoin(print) });
      return;
    }
    gsap.set(print.el, { zIndex: prints.length + 1, transformPerspective: 700 });
    flights.push({
      print,
      x: fromX,
      y: fromY,
      vx,
      vy,
      rotation: Number(gsap.getProperty(print.el, 'rotation')),
      spin: vx * 0.18,
      age: 0,
      phase: Math.random() * Math.PI * 2,
    });
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(step);
    }
  };

  const toss = (direction: 1 | -1): void => {
    const { x, y } = slot(0);
    throwTop(TOSS.vx * direction, TOSS.vy, x, y);
  };

  const springBack = (print: Print): void => {
    const { x, y, rotation } = slot(0);
    root.classList.remove('is-dragging');
    gsap.to(print.el, { x, y, rotation, duration: 0.7, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
  };

  deck.addEventListener('pointerdown', (event) => {
    const print = top();
    if (!print || !(event.target instanceof Node) || !print.el.contains(event.target)) return;
    if (!event.isPrimary || event.button !== 0 || drag) return;
    gsap.killTweensOf(print.el);
    print.el.setPointerCapture(event.pointerId);
    root.classList.add('is-dragging');
    drag = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      t0: event.timeStamp,
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }],
    };
  });

  deck.addEventListener('pointermove', (event) => {
    const print = top();
    if (!drag || !print || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x0;
    const dy = event.clientY - drag.y0;
    const { x, y, rotation } = slot(0);
    gsap.set(print.el, { x: x + dx, y: y + dy, rotation: rotation + dx * 0.06 });
    drag.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    // Release velocity comes from the last stretch of the gesture only.
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
  });

  const release = (event: PointerEvent, cancelled: boolean): void => {
    const print = top();
    if (!drag || event.pointerId !== drag.id) return;
    const gesture = drag;
    drag = null;
    if (!print) return;
    root.classList.remove('is-dragging');
    if (cancelled) {
      springBack(print);
      return;
    }
    const dx = event.clientX - gesture.x0;
    const dy = event.clientY - gesture.y0;
    const { x, y } = slot(0);
    // A tap tosses the print, so the stack works without discovering the drag.
    if (Math.hypot(dx, dy) < 5 && event.timeStamp - gesture.t0 < 350) {
      toss(1);
      return;
    }
    const first = gesture.samples[0];
    const span = Math.max(1, event.timeStamp - first.t) / 1000;
    let vx = (event.clientX - first.x) / span;
    let vy = (event.clientY - first.y) / span;
    const speed = Math.hypot(vx, vy);
    const reach = Math.abs(dx) / print.el.offsetWidth;
    if (speed < THROW_SPEED && reach < THROW_REACH) {
      springBack(print);
      return;
    }
    if (speed < MIN_SPEED) {
      // Thrown on reach alone: carry on the way it was dragged.
      const length = Math.max(1, Math.hypot(dx, dy));
      vx = (dx / length) * MIN_SPEED;
      vy = (dy / length) * MIN_SPEED;
    }
    throwTop(vx, vy, x + dx, y + dy);
  };

  deck.addEventListener('pointerup', (event) => release(event, false));
  deck.addEventListener('pointercancel', (event) => release(event, true));

  // The focus ring is for keyboards; a click or drag focuses the stack too.
  root.addEventListener('pointerdown', () => root.classList.remove('is-keyed'));
  root.addEventListener('keydown', (event) => {
    root.classList.add('is-keyed');
    if (drag) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') toss(1);
    else if (event.key === 'ArrowLeft') toss(-1);
    else return;
    event.preventDefault();
  });

  // The readout is bare type on the scene, so it takes whichever ink
  // contrasts with what is behind it. In the phone layout it sits on the
  // panel's haze instead and keeps the panel ink.
  let backdropTimer = 0;
  const readBackdrop = (): void => {
    if (getComputedStyle(root).position !== 'absolute') {
      delete root.dataset.backdrop;
      return;
    }
    const luminance = backdropLuminance(readout.getBoundingClientRect());
    if (luminance >= 0) root.dataset.backdrop = luminance > LIGHT_BACKDROP ? 'light' : 'dark';
  };
  new IntersectionObserver(([entry]) => {
    window.clearInterval(backdropTimer);
    if (!entry?.isIntersecting) return;
    readBackdrop();
    backdropTimer = window.setInterval(readBackdrop, BACKDROP_EVERY);
  }).observe(readout);

  restack(false);
  return root;
}
