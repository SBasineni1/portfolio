const DRAG_THRESHOLD = 6;

export function attachRail(rail: HTMLElement, reduced: () => boolean): () => void {
  let startX = 0;
  let startScrollLeft = 0;
  let pointerId = -1;
  let dragged = false;
  let maxScroll = 0;
  const targets: number[] = [];

  const cards = rail.querySelectorAll<HTMLElement>(':scope > .card');

  const nearestCard = (): number => {
    let nearest = 0;
    let distance = Infinity;
    const atEnd = Math.abs(rail.scrollLeft - maxScroll) <= 1;
    for (let i = 0; i < targets.length; i++) {
      const delta = Math.abs(targets[i] - rail.scrollLeft);
      if (delta < distance || (atEnd && delta === distance)) {
        nearest = i;
        distance = delta;
      }
    }
    return nearest;
  };

  const endDrag = (event: PointerEvent): void => {
    if (event.pointerId !== pointerId) return;
    pointerId = -1;
    rail.classList.remove('is-dragging');
    if (!dragged) return;
    rail.addEventListener(
      'click',
      (click) => {
        click.preventDefault();
        click.stopPropagation();
      },
      { capture: true, once: true },
    );
  };

  rail.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = rail.scrollLeft;
    dragged = false;
  });
  rail.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    // Released outside the rail before it became a drag: forget the press.
    if ((event.buttons & 1) === 0) {
      pointerId = -1;
      return;
    }
    const delta = event.clientX - startX;
    // Only a real drag takes the pointer: capturing on press would send
    // every click to the rail, and links inside the cards would never open.
    if (!dragged && Math.abs(delta) > DRAG_THRESHOLD) {
      dragged = true;
      rail.setPointerCapture(pointerId);
      rail.classList.add('is-dragging');
    }
    if (dragged) rail.scrollLeft = startScrollLeft - delta;
  });
  rail.addEventListener('pointerup', endDrag);
  rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const active = document.activeElement;
    if (!active || !rail.contains(active) || cards.length === 0) return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    event.preventDefault();
    for (let next = nearestCard() + direction; next >= 0 && next < targets.length; next += direction) {
      if (Math.abs(targets[next] - rail.scrollLeft) <= 1) continue;
      rail.scrollTo({
        left: targets[next],
        behavior: reduced() ? 'auto' : 'smooth',
      });
      break;
    }
  });

  return (): void => {
    maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
    const padding = Number.parseFloat(getComputedStyle(rail).scrollPaddingInlineStart) || 0;
    for (let i = 0; i < cards.length; i++) {
      const margin = Number.parseFloat(getComputedStyle(cards[i]).scrollMarginInlineStart) || 0;
      // The positioned rail is the offset parent, so entrance transforms don't affect targets.
      targets[i] = Math.min(maxScroll, Math.max(0, cards[i].offsetLeft - padding - margin));
    }
  };
}
