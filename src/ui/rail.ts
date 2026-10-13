const DRAG_THRESHOLD = 6;

export function attachRail(
  rail: HTMLElement,
  ruler: HTMLElement | null,
  reduced: () => boolean,
): () => void {
  let startX = 0;
  let startScrollLeft = 0;
  let pointerId = -1;
  let dragged = false;
  let step = 1;
  let current = -1;

  const cards = rail.querySelectorAll<HTMLElement>(':scope > .card');
  const ticks: HTMLElement[] = [];
  let count: HTMLElement | null = null;

  if (ruler) {
    for (let i = 0; i < cards.length; i++) {
      const tick = document.createElement('span');
      tick.className = 'ruler__tick';
      ruler.append(tick);
      ticks.push(tick);
    }
    count = document.createElement('span');
    count.className = 'ruler__count';
    ruler.append(count);
  }

  const updateRuler = (): void => {
    if (!count || cards.length === 0) return;
    const next = Math.min(cards.length - 1, Math.max(0, Math.round(rail.scrollLeft / step)));
    if (next === current) return;
    if (current >= 0) ticks[current].classList.remove('is-current');
    current = next;
    ticks[current].classList.add('is-current');
    count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
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
    if (!active || !rail.contains(active)) return;
    rail.scrollBy({
      left: event.key === 'ArrowLeft' ? -step : step,
      behavior: reduced() ? 'auto' : 'smooth',
    });
    event.preventDefault();
  });
  rail.addEventListener('scroll', updateRuler, { passive: true });

  return (): void => {
    if (cards.length > 1) {
      step = cards[1].offsetLeft - cards[0].offsetLeft;
    }
    if (step <= 0 || cards.length === 1) {
      if (cards.length === 0) return;
      const styles = getComputedStyle(rail);
      step = cards[0].offsetWidth + Number.parseFloat(styles.columnGap || styles.gap) || 1;
    }
    if (step <= 0) step = 1;
    updateRuler();
  };
}
