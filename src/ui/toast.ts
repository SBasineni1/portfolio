import { EASE_OUT, EASE_SETTLE, gsap, SplitText } from './motion';
import { scrollToAltitude } from './nav';

/** The pad note waits for the hero to settle before it slides in. */
const REVEAL_DELAY = 1100;
/** Gap between the balloon's envelope and the docked note, px. */
const DOCK_GAP = 30;
/** Keep the docked note this far above the bottom edge: the pad and gear live there. */
const GROUND_CLEARANCE = 170;

export interface LaunchNote {
  /**
   * The balloon's envelope this frame (on desktop the note docks beside it),
   * and whether it has been released from the pad: release dismisses the note.
   */
  track(x: number, y: number, r: number, released: boolean): void;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function overlap(a: Box, b: Box): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * Launch note, shown on every visit while the balloon is on the pad.
 * On desktop it docks as a callout beside the balloon — on whichever side is
 * clear of the portrait and the intro, above the staging pad — and follows
 * the balloon while it is dragged. On narrow screens it sits along the
 * bottom edge.
 * It is chrome, not part of the sounding: it does not ride --launch like the
 * rest of the page, it just leaves the moment the balloon does — when the
 * tether is released from the pad (~55 m), or when dismissed. It arrives as a short GSAP sequence (slab,
 * signal dot and its ping, title rising out of a mask, copy, actions); under
 * reduced motion it simply appears.
 */
export function mountToast(reduced: () => boolean): LaunchNote {
  const idle: LaunchNote = { track: () => undefined };
  const node = document.querySelector<HTMLElement>('[data-toast]');
  if (!node) return idle;

  let dismissed = false;
  let revealTimer = 0;
  let entrance: gsap.core.Timeline | undefined;

  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    window.clearTimeout(revealTimer);
    entrance?.kill();
    node.classList.remove('is-open', 'is-docking');
    if (reduced() || !entrance) {
      node.classList.add('is-gone');
      return;
    }
    // Leaving is faster than arriving: the reader has already started.
    gsap.to(node, {
      opacity: 0,
      y: 10,
      scale: 0.99,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => node.classList.add('is-gone'),
    });
  };

  node.querySelector('[data-toast-close]')?.addEventListener('click', dismiss);
  node.querySelector('[data-toast-launch]')?.addEventListener('click', () => {
    scrollToAltitude(260, 'about', reduced);
    dismiss();
  });
  node.querySelector('[data-toast-skip]')?.addEventListener('click', () => {
    scrollToAltitude(34600, 'contact', reduced);
    dismiss();
  });

  const pointer = document.createElement('span');
  pointer.className = 'toast__pointer';
  pointer.setAttribute('aria-hidden', 'true');
  node.append(pointer);
  const avoid = [document.querySelector<HTMLElement>('[data-profile]'), document.querySelector<HTMLElement>('.hero__intro')];
  let x = 0;
  let y = 0;
  let placed = false;
  let onRight: boolean | undefined;

  const track = (bx: number, by: number, r: number, released: boolean): void => {
    // The note belongs to the balloon on the pad. It leaves when the tether is
    // released, not on any scroll: page nudges, overscroll and the balloon's
    // settle-in bounce on load all happen while it is still tied down.
    if (released) dismiss();
    if (dismissed || (!node.classList.contains('is-open') && !node.classList.contains('is-docking'))) return;
    const docked = window.innerWidth >= 900;
    node.classList.toggle('is-docked', docked);
    if (!docked) {
      node.style.removeProperty('left');
      node.style.removeProperty('top');
      placed = false;
      onRight = undefined;
      return;
    }
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const vh = window.innerHeight;
    const top = Math.min(vh - GROUND_CLEARANCE - h, Math.max(76, by - h * 0.5));
    const right: Box = { left: bx + r + DOCK_GAP, top, right: bx + r + DOCK_GAP + w, bottom: top + h };
    const left: Box = { left: bx - r - DOCK_GAP - w, top, right: bx - r - DOCK_GAP, bottom: top + h };
    const cost = (box: Box): number => {
      let c = 0;
      for (const el of avoid) if (el) c += overlap(box, el.getBoundingClientRect());
      if (box.left < 12 || box.right > window.innerWidth - 132) c += 1e9;
      return c;
    };
    // Hysteresis: keep the current side unless the other is clearly clearer,
    // so a bobbing balloon does not flip the note back and forth.
    const costRight = cost(right);
    const costLeft = cost(left);
    if (onRight === undefined) onRight = costRight <= costLeft;
    else if (onRight && costRight > costLeft + 6000) onRight = false;
    else if (!onRight && costLeft > costRight + 6000) onRight = true;
    const side = onRight ? right : left;
    node.classList.toggle('is-left', !onRight);
    // Ease toward the target so a dragged balloon tows the note rather than shaking it.
    const k = placed && !reduced() ? 0.22 : 1;
    x += (side.left - x) * k;
    y += (side.top - y) * k;
    placed = true;
    node.style.left = `${x.toFixed(1)}px`;
    node.style.top = `${y.toFixed(1)}px`;
    // Point at the envelope's centre, within the note's rounded corners.
    node.style.setProperty('--pointer-y', `${Math.min(h - 22, Math.max(22, by - y)).toFixed(1)}px`);
  };

  revealTimer = window.setTimeout(() => {
    if (dismissed) return;
    if (reduced()) {
      node.classList.add('is-open');
      return;
    }
    entrance = arrive(node);
    node.classList.add('is-open');
  }, REVEAL_DELAY);
  // Dock before the reveal so the note appears in place, not at the bottom.
  node.classList.add('is-docking');
  return { track };
}

function arrive(node: HTMLElement): gsap.core.Timeline {
  // GSAP owns the visuals from here; the stylesheet keeps only the states.
  node.style.transition = 'none';
  const dot = node.querySelector<HTMLElement>('.toast__dot');
  const title = node.querySelector<HTMLElement>('.toast__title');
  const text = node.querySelector<HTMLElement>('.toast__text');
  const actions = [...node.querySelectorAll<HTMLElement>('.toast__action, .toast__sep, .toast__close')];
  // Whole words stay intact, so the text reads as it is without an aria-label.
  const titleSplit = title ? SplitText.create(title, { type: 'words', mask: 'words', aria: 'none' }) : undefined;
  const textSplit = text ? SplitText.create(text, { type: 'lines', mask: 'lines', aria: 'none' }) : undefined;

  const ping = document.createElement('span');
  ping.className = 'toast__ping';
  ping.setAttribute('aria-hidden', 'true');
  dot?.append(ping);

  const tl = gsap.timeline({
    onComplete: () => {
      titleSplit?.revert();
      textSplit?.revert();
    },
  });
  tl.fromTo(node, { opacity: 0, y: 28, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: EASE_OUT }, 0);
  if (dot) tl.fromTo(dot, { scale: 0 }, { scale: 1, duration: 0.5, ease: 'back.out(2.4)' }, 0.18);
  tl.fromTo(ping, { scale: 1, opacity: 0.8 }, { scale: 2.6, opacity: 0, duration: 1.1, ease: 'power2.out', repeat: 2, repeatDelay: 0.5 }, 0.45);
  if (titleSplit) tl.from(titleSplit.words, { yPercent: 110, duration: 0.6, stagger: 0.05, ease: EASE_OUT }, 0.22);
  if (textSplit) tl.from(textSplit.lines, { yPercent: 110, duration: 0.7, stagger: 0.08, ease: EASE_OUT }, 0.34);
  tl.from(actions, { y: 8, opacity: 0, duration: 0.45, stagger: 0.06, ease: EASE_SETTLE }, 0.55);
  return tl;
}
