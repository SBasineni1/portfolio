import type { Balloon } from './physics/balloon';

/**
 * Pointer + touch grabbing. The canvas keeps `touch-action: pan-y` so a
 * vertical swipe still scrolls the page (i.e. still flies the balloon) while
 * sideways drags play with it.
 */
export function attachInput(canvas: HTMLCanvasElement, balloon: Balloon): void {
  let activePointer = -1;
  let hovering = false;

  const setCursor = (): void => {
    canvas.classList.toggle('is-grabbing', activePointer !== -1);
    canvas.classList.toggle('is-grabbable', activePointer === -1 && hovering);
  };

  canvas.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      if (activePointer !== -1) return;
      if (!balloon.grab(e.clientX, e.clientY)) return;
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
    if (e.pointerType === 'touch') return;
    const next = balloon.pick(e.clientX, e.clientY) >= 0;
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
    setCursor();
  });
}
