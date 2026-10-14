import type { AboutPhoto } from '../content';
import { el, loadLater } from './dom';

/** Seconds each photograph holds before the next slides in. */
const HOLD = 6;
/** A release past this fraction of the width, or this fast (px/ms), turns the page. */
const SWIPE_REACH = 0.18;
const SWIPE_SPEED = 0.45;
/** Seconds the controls stay up after a touch. */
const TOUCH_LINGER = 2.5;

const SVG = 'http://www.w3.org/2000/svg';

function chevron(direction: -1 | 1): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', direction < 0 ? 'M10 3.5 5.5 8l4.5 4.5' : 'M6 3.5 10.5 8 6 12.5');
  svg.append(path);
  return svg;
}

/**
 * A swiping photo carousel inside `host`: the photographs sit side by side
 * on a track that slides one frame at a time, on its own every few seconds
 * while on screen. Drag or swipe it, use the arrow buttons, or the arrow
 * keys. The title sits top left; the current photo's caption bottom left.
 * Arrows and dots stay out of the photo until the visitor reaches for it
 * (hover, focus, or a touch), so captions have the bottom edge to
 * themselves. It loops: a copy of the first photo trails the last, and the
 * track jumps back without a transition once it gets there.
 *
 * Hovering, focusing or dragging holds it. Under reduced motion it neither
 * slides nor advances on its own; the controls just change the photo.
 */
export function mountCarousel(host: HTMLElement, photos: AboutPhoto[], title: string | undefined, reduced: () => boolean): void {
  host.classList.add('carousel');
  host.setAttribute('role', 'region');
  host.setAttribute('aria-roledescription', 'carousel');
  host.setAttribute('aria-label', title ?? 'Photos');

  const track = el('div', 'carousel__track');
  const frames = [...photos, photos[0]].map((photo, index) => {
    const frame = el('div', 'carousel__frame');
    const image = el('img');
    loadLater(image, photo.src);
    image.alt = index === photos.length ? '' : photo.alt;
    image.decoding = 'async';
    image.draggable = false;
    image.loading = index === 0 ? 'eager' : 'lazy';
    frame.append(image);
    if (index === photos.length) frame.setAttribute('aria-hidden', 'true');
    track.append(frame);
    return image;
  });
  host.append(track);

  if (title) host.append(el('p', 'carousel__title', title));
  const caption = el('p', 'carousel__caption');
  caption.setAttribute('aria-live', 'polite');
  host.append(caption);

  const arrow = (direction: -1 | 1): HTMLButtonElement => {
    const button = el('button', `carousel__arrow carousel__arrow--${direction < 0 ? 'prev' : 'next'}`);
    button.type = 'button';
    button.setAttribute('aria-label', direction < 0 ? 'Previous photo' : 'Next photo');
    button.append(chevron(direction));
    button.addEventListener('click', () => step(direction));
    host.append(button);
    return button;
  };
  arrow(-1);
  arrow(1);

  const dots = el('div', 'carousel__dots');
  const buttons = photos.map((photo, index) => {
    const dot = el('button', 'carousel__dot');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Photo ${index + 1} of ${photos.length}: ${photo.alt}`);
    dot.addEventListener('click', () => go(index));
    dots.append(dot);
    return dot;
  });
  host.append(dots);

  const count = photos.length;
  /** Track position in frames, 0..count (count is the trailing copy of 0). */
  let position = 0;
  let timer = 0;
  let visible = false;
  let held = false;
  let touchTimer = 0;

  const place = (animate: boolean, offset = 0): void => {
    track.classList.toggle('is-moving', animate && !reduced());
    track.style.transform = `translate3d(calc(${-position * 100}% + ${offset}px), 0, 0)`;
  };

  const sync = (): void => {
    const current = position % count;
    buttons.forEach((dot, i) => dot.toggleAttribute('aria-current', i === current));
    caption.textContent = photos[current].caption ?? '';
    caption.hidden = !caption.textContent;
    // Fetch the neighbours ahead of their turn.
    frames[(current + 1) % count].loading = 'eager';
    frames[(current - 1 + count) % count].loading = 'eager';
    schedule();
  };

  function go(index: number): void {
    position = index;
    place(true);
    sync();
  }

  /** Without a transition, move to `next` (the same picture, another copy). */
  const jump = (next: number): void => {
    position = next;
    place(false);
    // Commit the jump before the slide that follows animates from it.
    void track.offsetWidth;
  };

  function step(direction: -1 | 1): void {
    // Always leave from a real frame, even mid-slide: clicked quickly, the
    // track would otherwise run past the trailing copy into empty space.
    if (position >= count) jump(position - count);
    // Going back from the first photo: stand on its copy, then slide to the last.
    if (direction < 0 && position === 0) jump(count);
    position += direction;
    place(true);
    sync();
  }

  // Arriving on the trailing copy: swap to the real first photo, unseen.
  track.addEventListener('transitionend', () => {
    if (position >= count) jump(position - count);
  });

  function schedule(): void {
    window.clearTimeout(timer);
    if (visible && !held && !reduced() && count > 1) timer = window.setTimeout(() => step(1), HOLD * 1000);
  }

  const hold = (next: boolean): void => {
    held = next;
    schedule();
  };
  host.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') hold(true);
  });
  host.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') hold(false);
  });
  host.addEventListener('focusin', () => hold(true));
  host.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && host.contains(event.relatedTarget))) hold(false);
  });
  host.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else return;
    event.preventDefault();
  });

  // Drag or swipe: the track follows the pointer, then turns or settles.
  let drag: { id: number; x: number; t: number; dx: number } | null = null;
  track.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (position >= count) jump(position - count);
    drag = { id: event.pointerId, x: event.clientX, t: event.timeStamp, dx: 0 };
    track.setPointerCapture(event.pointerId);
    host.classList.add('is-dragging');
    if (event.pointerType !== 'mouse') {
      window.clearTimeout(touchTimer);
      host.classList.add('is-touched');
    }
    hold(true);
  });
  track.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dx = event.clientX - drag.x;
    place(false, drag.dx);
  });
  const release = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.id) return;
    const { dx, t } = drag;
    drag = null;
    host.classList.remove('is-dragging');
    const speed = Math.abs(dx) / Math.max(1, event.timeStamp - t);
    if (Math.abs(dx) > host.clientWidth * SWIPE_REACH || (speed > SWIPE_SPEED && Math.abs(dx) > 12)) step(dx < 0 ? 1 : -1);
    else place(true);
    if (event.pointerType !== 'mouse') {
      touchTimer = window.setTimeout(() => host.classList.remove('is-touched'), TOUCH_LINGER * 1000);
      hold(false);
    } else if (!host.matches(':hover')) {
      hold(false);
    }
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  new IntersectionObserver(([entry]) => {
    visible = Boolean(entry?.isIntersecting);
    schedule();
  }).observe(host);
  go(0);
}
