import { el } from './dom';

/**
 * Sandbox mode: the portfolio steps aside and the balloon is the whole page.
 *
 * A toggle in the nav fades the content out; scrolling still flies the
 * balloon up and down, now over an empty sky (past ~30 km it bursts; back
 * down, it reinflates). A cream control tag (same stock as the launch-site
 * tag) adds Gust, Weather (steps through the conditions) and Reset (back to
 * the pad). Exit, Esc, or the toggle again
 * returns to the exact scroll position the visitor left from.
 */

export interface SandboxHooks {
  /** Snap straight back to the pad. */
  reset(): void;
  gust(): void;
  /** Step to the next kind of weather. */
  cycleWeather(): void;
  /** Called after entering or leaving, once the page state has changed. */
  onChange(active: boolean): void;
}

export interface Sandbox {
  readonly active: boolean;
  /** Enter the sandbox (as the toggle does). */
  open(): void;
}

const SVG = 'http://www.w3.org/2000/svg';

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const p = document.createElementNS(SVG, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

const PLAY = 'M5.5 3.6v8.8l7-4.4z';
const CLOSE = 'M4.5 4.5l7 7M11.5 4.5l-7 7';

export function mountSandbox(hooks: SandboxHooks): Sandbox {
  let active = false;
  let savedScroll = 0;

  // The toggle lives in the nav, after the section links.
  const toggle = el('button', 'nav__sandbox');
  toggle.type = 'button';
  toggle.setAttribute('aria-pressed', 'false');
  const toggleIcon = icon(PLAY);
  const toggleLabel = el('span', 'nav__sandbox-label', 'Sandbox');
  toggle.append(toggleIcon, toggleLabel);
  document.querySelector('.nav')?.append(toggle);

  const panel = el('div', 'sandbox');
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Balloon sandbox controls');
  panel.hidden = true;

  const title = el('span', 'sandbox__title', 'Sandbox');

  const gust = el('button', 'sandbox__action', 'Gust');
  gust.type = 'button';
  const weather = el('button', 'sandbox__action', 'Weather');
  weather.type = 'button';
  const reset = el('button', 'sandbox__action', 'Reset');
  reset.type = 'button';
  const exit = el('button', 'sandbox__exit');
  exit.type = 'button';
  exit.setAttribute('aria-label', 'Exit sandbox');
  exit.append(icon(CLOSE));
  panel.append(title, gust, weather, reset, exit);
  document.body.append(panel);

  const enter = (): void => {
    if (active) return;
    active = true;
    savedScroll = window.scrollY;
    document.documentElement.classList.add('is-sandbox');
    toggle.setAttribute('aria-pressed', 'true');
    toggle.replaceChildren(icon(CLOSE), el('span', 'nav__sandbox-label', 'Exit'));
    toggle.setAttribute('aria-label', 'Exit sandbox');
    panel.hidden = false;
    hooks.onChange(true);
  };

  const leave = (): void => {
    if (!active) return;
    active = false;
    document.documentElement.classList.remove('is-sandbox');
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
    toggle.setAttribute('aria-pressed', 'false');
    toggle.replaceChildren(toggleIcon, toggleLabel);
    toggle.removeAttribute('aria-label');
    panel.hidden = true;
    hooks.onChange(false);
    toggle.focus({ preventScroll: true });
  };

  toggle.addEventListener('click', () => (active ? leave() : enter()));
  exit.addEventListener('click', leave);
  gust.addEventListener('click', () => hooks.gust());
  weather.addEventListener('click', () => hooks.cycleWeather());
  reset.addEventListener('click', () => hooks.reset());
  window.addEventListener('keydown', (event) => {
    if (active && event.key === 'Escape') leave();
  });
  // The nav's own links lead back into the page.
  document.querySelector('.nav__mark')?.addEventListener('click', leave);

  return {
    get active(): boolean {
      return active;
    },
    open: enter,
  };
}
