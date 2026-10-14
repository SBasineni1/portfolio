import { el } from './dom';

/** Gap kept below the hanging nav tab, so the window never slides under it. */
const NAV_GAP = 12;
const EDGE = 16;
/** How far into the cover the window's lower edge sits. */
const SEAT = 20;
const MAX_WIDTH = 760;
/** Quiet time after the last scroll event before the window may open again. */
const SETTLE_MS = 160;
/** How long the rail must rest on a card before its window opens unasked. */
const DWELL_MS = 2000;

interface Target {
  cover: HTMLElement;
  src: string;
}

const targets = new WeakMap<HTMLElement, Target>();
let layer: HTMLDivElement | undefined;
let shot: HTMLImageElement | undefined;
let current: HTMLElement | undefined;
let settle = 0;
let dwell = 0;
const pointer = { x: -1, y: -1, buttons: 0 };

const scrolling = (): boolean => settle !== 0;

/** One window for the whole page, outside the rail, so the rail's scroll clip and fade never cut it. */
function ensureLayer(): void {
  if (layer) return;
  layer = el('div', 'preview-pop');
  layer.setAttribute('aria-hidden', 'true');
  shot = el('img');
  shot.alt = '';
  layer.append(shot);
  document.body.append(layer);

  // A window chasing its card across a scroll reads as a smear. Any scroll
  // (the page's ascent or the rail's sideways run) shuts it at once; when the
  // scroll comes to rest it opens for whatever card is then under the pointer.
  window.addEventListener(
    'scroll',
    () => {
      if (current) close(current, true);
      window.clearTimeout(settle);
      window.clearTimeout(dwell);
      settle = window.setTimeout(() => {
        settle = 0;
        reopen();
        dwell = window.setTimeout(() => openSettled(), DWELL_MS);
      }, SETTLE_MS);
    },
    { capture: true, passive: true },
  );
  window.addEventListener('resize', () => current && place(current), { passive: true });
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.buttons = event.buttons;
    },
    { passive: true },
  );
}

/** The card the pointer rests on, else the one keyboard focus is in. */
function reopen(): void {
  let card: HTMLElement | null = null;
  if (pointer.x >= 0 && pointer.buttons === 0) {
    card = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>('.card--project') ?? null;
  }
  if (!card || !targets.has(card)) {
    card = document.querySelector<HTMLElement>(':focus-visible')?.closest<HTMLElement>('.card--project') ?? null;
  }
  if (card && targets.has(card)) open(card);
}

/**
 * Resting on a card is a look at it too: once the page and the rail have both
 * been still for DWELL_MS, the settled card opens its window without a hover.
 * Nothing opens over a section that is still fading in or only part on screen.
 */
function openSettled(tries = 0): void {
  if (current || pointer.buttons !== 0 || scrolling()) return;
  let arriving = false;
  for (const station of document.querySelectorAll<HTMLElement>('.station')) {
    if (!station.querySelector('.card--project')) continue;
    const presence = parseFloat(station.style.getPropertyValue('--in')) || 0;
    if (presence < 0.95) {
      arriving ||= presence > 0.05;
      continue;
    }
    for (const card of station.querySelectorAll<HTMLElement>('.card--project')) {
      const box = card.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight || !inView(card)) continue;
      if (targets.has(card)) open(card);
      return;
    }
    // Present but no card fully in place yet: the rail may still be sweeping in.
    arriving = true;
  }
  // Still fading or sweeping in: look again shortly rather than give up.
  if (arriving && tries < 8) dwell = window.setTimeout(() => openSettled(tries + 1), 400);
}

/**
 * Only the card the rail has settled on opens a window; a neighbour peeking in
 * at the rail's fading edge does not, since its window would sit over the fade.
 */
function inView(card: HTMLElement): boolean {
  const rail = card.closest('.rail');
  if (!rail) return true;
  const bounds = rail.getBoundingClientRect();
  const box = card.getBoundingClientRect();
  const shown = Math.min(box.right, bounds.right) - Math.max(box.left, bounds.left);
  return shown >= box.width * 0.9;
}

/** Seat the window's lower edge inside the cover and let it rise over the card and the sky above. */
function place(card: HTMLElement): void {
  const target = targets.get(card);
  if (!target || !layer || !shot) return;
  const cover = target.cover.getBoundingClientRect();
  const ratio = shot.naturalWidth && shot.naturalHeight ? shot.naturalWidth / shot.naturalHeight : 1.6;
  const bottom = cover.bottom - SEAT;
  const ceiling = (document.querySelector('.nav')?.getBoundingClientRect().bottom ?? 0) + NAV_GAP;
  let width = Math.min(cover.width * 0.86, MAX_WIDTH, innerWidth - EDGE * 2);
  let height = width / ratio;
  if (bottom - height < ceiling) {
    height = Math.max(bottom - ceiling, 0);
    width = height * ratio;
  }
  const left = Math.min(Math.max(cover.left + cover.width / 2 - width / 2, EDGE), innerWidth - width - EDGE);
  layer.style.left = `${left}px`;
  layer.style.top = `${bottom - height}px`;
  layer.style.width = `${width}px`;
  layer.style.height = `${height}px`;
}

/** Grow from the pointer when it is on the card, else from the middle of the cover. */
function bloomFrom(card: HTMLElement): void {
  const target = targets.get(card);
  if (!target || !layer) return;
  // The laid-out box, not getBoundingClientRect: that one is already scaled down.
  const left = parseFloat(layer.style.left);
  const top = parseFloat(layer.style.top);
  const cover = target.cover.getBoundingClientRect();
  const onCard = pointer.x >= 0 && card.matches(':hover');
  const x = onCard ? pointer.x : cover.left + cover.width / 2;
  const y = onCard ? pointer.y : cover.top + cover.height / 2;
  layer.style.transformOrigin = `${x - left}px ${y - top}px`;
}

function open(card: HTMLElement): void {
  const target = targets.get(card);
  ensureLayer();
  if (!target || !layer || !shot || scrolling() || !inView(card)) return;
  // Already up (opened by a dwell, then hovered): leave it be, don't re-bloom.
  if (current === card && layer.classList.contains('is-open')) return;
  if (current && current !== card) current.classList.remove('is-popped');
  current = card;
  card.classList.add('is-popped');
  const reveal = (): void => {
    if (current !== card || !layer || scrolling()) return;
    // Every opening starts from the thumbnail: drop to it with no transition,
    // move, then let it grow.
    layer.classList.add('is-cut');
    layer.classList.remove('is-open');
    place(card);
    bloomFrom(card);
    void layer.offsetWidth;
    layer.classList.remove('is-cut');
    layer.classList.add('is-open');
    // The section's heading and group label sit under the window; clear them.
    card.closest('.station')?.classList.add('has-pop');
  };
  if (shot.getAttribute('src') === target.src && shot.complete) {
    reveal();
    return;
  }
  layer.classList.remove('is-open');
  shot.src = target.src;
  // Wait for the pixels so the window never opens empty.
  shot.decode().then(reveal, reveal);
}

/** `cut` drops the window with no fade, for a scroll: a fading window would hang where the card was. */
function close(card: HTMLElement, cut = false): void {
  if (current !== card) return;
  card.classList.remove('is-popped');
  card.closest('.station')?.classList.remove('has-pop');
  current = undefined;
  layer?.classList.toggle('is-cut', cut);
  layer?.classList.remove('is-open');
}

/**
 * The project's screenshot opens over the card on hover or keyboard focus.
 * Pointers that can hover only; touch screens reveal it inside the cover.
 */
export function attachPreviewPop(card: HTMLElement, cover: HTMLElement, src: string): void {
  targets.set(card, { cover, src });
  // Up front, not on first hover: the dwell timer rides on its scroll listener.
  ensureLayer();
  card.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    open(card);
  });
  card.addEventListener('pointerleave', () => close(card));
  // A drag along the rail is not a look at the card.
  card.addEventListener('pointerdown', () => close(card, true));
  card.addEventListener('focusin', () => open(card));
  card.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node && card.contains(next))) close(card);
  });
}
