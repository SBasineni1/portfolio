import { site } from '../content';
import { el } from './dom';

/** Per-character cadence, ms. The nameplate is set at display size, so it
 *  types slower than the line under it — a big glyph needs the time. */
const NAME_STEP = 62;
const TAGLINE_STEP = 7;
const NAME_WIPE = 30;
/** Beat between the nameplate landing and the line under it starting. */
const HANDOFF = 520;
/** How long the finished pair sits. Long enough to read the line under
 *  the nameplate twice over, since that is the whole point of it. */
const HOLD = 5200;
const RESTART = 520;
/** The line does not un-type — it just goes. */
const VANISH = 260;
/** Below this the hero is still on screen; above it, the loop idles. */
const ON_SCREEN = 0.9;

interface Layer {
  readonly text: string;
  readonly sink: Text;
  readonly line: HTMLElement;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/**
 * Three stacked copies of the same string, so nothing on the page moves while
 * the text is only partly typed:
 *   ghost — the full string at full size, hidden but still laid out. It holds
 *           the block open, which is why there is no measuring code here and
 *           nothing to recompute on resize.
 *   line  — the visible one, filled a character at a time, with the caret.
 *   read  — off-screen, for screen readers, so assistive tech gets the whole
 *           sentence once instead of a hundred partial ones.
 */
function buildLayer(host: HTMLElement, text: string): Layer {
  const ghost = el('span', 'hero__ghost', text);
  ghost.setAttribute('aria-hidden', 'true');

  const line = el('span', 'hero__line');
  line.setAttribute('aria-hidden', 'true');
  const sink = document.createTextNode('');
  line.append(sink, el('span', 'hero__caret'));

  const read = el('span', 'hero__read', text);

  host.replaceChildren(ghost, line, read);
  return { text, sink, line };
}

/** Park the loop while the tab is in the background or the flight has left
 *  the hero behind — an off-screen animation is pure cost. */
async function idle(): Promise<void> {
  while (document.hidden || window.scrollY > window.innerHeight * ON_SCREEN) {
    await sleep(400);
  }
}

async function type(layer: Layer, step: number): Promise<void> {
  hold(layer);
  for (let i = 1; i <= layer.text.length; i++) {
    layer.sink.data = layer.text.slice(0, i);
    await sleep(step);
  }
  layer.line.classList.remove('is-live');
}

/** Exactly one caret is on the page at a time: the one on the line being
 *  written. It stays lit while characters land and blinks once they stop. */
function hold(layer: Layer): void {
  for (const other of document.querySelectorAll('.hero__line')) {
    other.classList.remove('is-active', 'is-live');
  }
  layer.line.classList.add('is-active', 'is-live');
}

async function wipe(layer: Layer, step: number): Promise<void> {
  hold(layer);
  for (let i = layer.sink.data.length - 1; i >= 0; i--) {
    layer.sink.data = layer.text.slice(0, i);
    await sleep(step);
  }
  layer.line.classList.remove('is-live');
}

/** Clear a line in one move rather than backspacing it. */
async function vanish(layer: Layer): Promise<void> {
  layer.line.classList.remove('is-active', 'is-live');
  layer.line.classList.add('is-gone');
  await sleep(VANISH);
  layer.sink.data = '';
  layer.line.classList.remove('is-gone');
}

async function run(name: Layer, tagline: Layer): Promise<void> {
  for (;;) {
    await idle();
    await type(name, NAME_STEP);
    await sleep(HANDOFF);
    await type(tagline, TAGLINE_STEP);
    await sleep(HOLD);
    await vanish(tagline);
    await wipe(name, NAME_WIPE);
    await sleep(RESTART);
  }
}

/**
 * The nameplate and the line under it type themselves out, hold, wipe and go
 * again — a station readout that keeps repeating rather than a one-shot
 * reveal. Reduced motion gets both strings, printed, with no loop.
 */
export function startHeroTypewriter(reduced: () => boolean): void {
  const nameHost = document.querySelector<HTMLElement>('[data-hero-name]');
  const taglineHost = document.querySelector<HTMLElement>('[data-tagline]');
  if (!nameHost || !taglineHost) return;

  const name = buildLayer(nameHost, site.heroName);
  const tagline = buildLayer(taglineHost, site.tagline);

  if (reduced()) {
    name.sink.data = name.text;
    tagline.sink.data = tagline.text;
    return;
  }

  void run(name, tagline);
}
