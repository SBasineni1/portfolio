import type { Balloon } from './physics/balloon';

/** Something on the pad that answers the pointer (see world/pad.ts). */
export interface Touchable {
  /** Whether (x, y) is over something that reacts. */
  pick(x: number, y: number): boolean;
  /** A click or tap at (x, y). */
  poke(x: number, y: number): void;
  /** The pointer passing over at (x, y) with velocity (vx, vy) px/s: it fans, flicks, brushes. */
  brush(x: number, y: number, vx: number, vy: number): void;
}

/**
 * Pointer + touch grabbing. The canvas keeps `touch-action: pan-y` so a
 * vertical swipe still scrolls the page (i.e. still flies the balloon) while
 * sideways drags play with it. Presses that miss the balloon go to the pad
 * gear, and so does a pointer moving over it.
 */
export function attachInput(canvas: HTMLCanvasElement, balloon: Balloon, pad: Touchable): void {
  let activePointer = -1;
  let hovering = false;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;

  const setCursor = (): void => {
    canvas.classList.toggle('is-grabbing', activePointer !== -1);
    canvas.classList.toggle('is-grabbable', activePointer === -1 && hovering);
  };

  canvas.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (activePointer !== -1) return;
      if (!balloon.grab(e.clientX, e.clientY)) {
        if (pad.pick(e.clientX, e.clientY)) pad.poke(e.clientX, e.clientY);
        return;
      }
      activePointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      if (e.pointerType !== 'touch') e.preventDefault();
      setCursor();
    },
    { passive: false },
  );

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerId === activePointer) {
      balloon.moveGrab(e.clientX, e.clientY);
      return;
    }
    const now = e.timeStamp / 1000;
    const dt = Math.max(1 / 240, Math.min(0.1, now - lastT));
    if (lastT > 0) pad.brush(e.clientX, e.clientY, (e.clientX - lastX) / dt, (e.clientY - lastY) / dt);
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;
    if (e.pointerType === 'touch') return;
    const next = balloon.pick(e.clientX, e.clientY) >= 0 || pad.pick(e.clientX, e.clientY);
    if (next !== hovering) {
      hovering = next;
      setCursor();
    }
  });

  const end = (e: PointerEvent): void => {
    if (e.pointerId !== activePointer) return;
    activePointer = -1;
    balloon.releaseGrab();
    setCursor();
  };

  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('pointerleave', () => {
    hovering = false;
    lastT = 0;
    setCursor();
  });
}
