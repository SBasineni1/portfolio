import { el } from './dom';
import { EASE_SETTLE, gsap } from './motion';

/**
 * Two tips, in the launch note's dark stock but smaller, for features that
 * stay out of the way until asked for:
 *
 *   weather — rest the pointer on the launch-site tag: turn on live weather.
 *   sandbox — rest it on the nav's Sandbox button: fly the balloon on its own.
 *
 * Built not to nag. A tip opens only after the pointer has rested on its
 * control for a moment (sweeping past does nothing), closes a little after
 * the pointer leaves both the control and the tip (time enough to reach its
 * button), and goes at once when the control itself is clicked. It retires
 * for the visit (a browser session) after showing twice, when its × is
 * pressed, or once its feature has been used. Keyboard focus opens it too;
 * touch screens have no hover, so there the controls speak for themselves.
 */

type TipName = 'weather' | 'sandbox';

interface TipSpec {
  name: TipName;
  key: string;
  text: string;
  action: string;
  onAction: () => void;
  /** What it explains: hovering or focusing this opens the tip. */
  anchor: () => HTMLElement | null;
  /** Whether it is worth showing right now (e.g. weather is still off). */
  relevant: () => boolean;
  /** Where it sits beside its anchor: fixed-position edges, kept current while open. */
  place: (node: HTMLElement, anchor: DOMRect) => void;
}

export interface Tips {
  /** Per frame: keep the open tip beside its anchor, or close it once the anchor has gone. */
  update(altitude: number, sandbox: boolean): void;
  /** The visitor used the feature: it needs no tip this visit. */
  used(tip: TipName): void;
}

/** The pad, metres: above this the site tag has gone, and so has its tip. */
const PAD_TOP = 55;
/** Rest this long on a control before its tip opens, ms. */
const OPEN_DELAY = 400;
/** After the pointer leaves the control and the tip, close this much later, ms. */
const CLOSE_DELAY = 1200;
/** A tip retires for the visit after showing this many times. */
const MAX_SHOWS = 2;

function read(key: string): number {
  try {
    return Number(sessionStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function write(key: string, value: number): void {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // Storage blocked: a tip may come back on a reload, which is harmless.
  }
}

export function mountTips(options: {
  reduced: () => boolean;
  weatherOn: () => boolean;
  sandboxOn: () => boolean;
  turnOnWeather: () => void;
  openSandbox: () => void;
}): Tips {
  let open: { node: HTMLElement; spec: TipSpec } | null = null;
  let openTimer = 0;
  let closeTimer = 0;
  const shows = new Map<TipName, number>();
  const retired = new Set<TipName>();

  const retire = (spec: TipSpec): void => {
    retired.add(spec.name);
    write(spec.key, MAX_SHOWS);
  };

  const close = (): void => {
    window.clearTimeout(closeTimer);
    if (!open) return;
    const { node } = open;
    open = null;
    if (options.reduced()) {
      node.remove();
      return;
    }
    gsap.to(node, { y: 6, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => node.remove() });
  };

  const closeSoon = (): void => {
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(close, CLOSE_DELAY);
  };

  const show = (spec: TipSpec): void => {
    window.clearTimeout(closeTimer);
    if (open?.spec === spec || retired.has(spec.name) || !spec.relevant()) return;
    const anchor = spec.anchor();
    if (!anchor) return;
    close();
    const count = (shows.get(spec.name) ?? 0) + 1;
    shows.set(spec.name, count);
    write(spec.key, count);
    if (count >= MAX_SHOWS) retired.add(spec.name);

    const node = el('aside', 'tip');
    node.setAttribute('role', 'note');
    // One line per sentence: the question, then the nudge. Set as lines, the
    // box can hug the longer one instead of wrapping into a dead column.
    const text = el('p', 'tip__text');
    for (const line of spec.text.split(/(?<=\?)\s+/)) text.append(el('span', 'tip__line', line));
    const action = el('button', 'tip__action', spec.action);
    action.type = 'button';
    action.addEventListener('click', () => {
      retire(spec);
      close();
      spec.onAction();
    });
    const dismiss = el('button', 'tip__close', '×');
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', 'Close this tip');
    dismiss.addEventListener('click', () => {
      retire(spec);
      close();
    });
    node.append(text, action, dismiss);
    // Reaching for the tip's own button keeps it open.
    node.addEventListener('pointerenter', () => window.clearTimeout(closeTimer));
    node.addEventListener('pointerleave', closeSoon);
    node.addEventListener('focusout', (event) => {
      if (!(event.relatedTarget instanceof Node) || !node.contains(event.relatedTarget)) closeSoon();
    });
    document.body.append(node);
    spec.place(node, anchor.getBoundingClientRect());
    open = { node, spec };
    if (!options.reduced()) gsap.from(node, { y: 8, opacity: 0, duration: 0.4, ease: EASE_SETTLE });
  };

  const specs: TipSpec[] = [
    {
      name: 'weather',
      key: 'portfolio:tip:weather:shows',
      text: 'Want some Weather? Enable weather conditions!',
      action: 'Turn on weather',
      onAction: options.turnOnWeather,
      anchor: () => document.querySelector<HTMLElement>('[data-site-picker]'),
      relevant: () => !options.weatherOn() && !options.sandboxOn(),
      place: (node, tag) => {
        node.style.left = `${Math.round(tag.left)}px`;
        node.style.bottom = `${Math.round(window.innerHeight - tag.top + 10)}px`;
      },
    },
    {
      name: 'sandbox',
      key: 'portfolio:tip:sandbox:shows',
      text: 'Just want to fly the balloon? Play sandbox mode!',
      action: 'Open sandbox',
      onAction: options.openSandbox,
      anchor: () => document.querySelector<HTMLElement>('.nav__sandbox'),
      relevant: () => !options.sandboxOn(),
      place: (node, button) => {
        const width = node.offsetWidth;
        const left = Math.min(window.innerWidth - width - 12, Math.max(12, button.right - width));
        node.style.left = `${Math.round(left)}px`;
        node.style.top = `${Math.round(button.bottom + 12)}px`;
      },
    },
  ];

  for (const spec of specs) {
    const count = read(spec.key);
    shows.set(spec.name, count);
    if (count >= MAX_SHOWS) retired.add(spec.name);
    const anchor = spec.anchor();
    if (!anchor) continue;
    // Hover is a mouse thing; a tap on a touch screen just presses the control.
    // `pointerover` also fires between the anchor's own parts, so a pointer
    // already resting on it still counts once it moves.
    anchor.addEventListener('pointerover', (event) => {
      if (event.pointerType !== 'mouse') return;
      if (open?.spec === spec) {
        window.clearTimeout(closeTimer);
        return;
      }
      window.clearTimeout(openTimer);
      openTimer = window.setTimeout(() => show(spec), OPEN_DELAY);
    });
    anchor.addEventListener('pointerleave', () => {
      window.clearTimeout(openTimer);
      if (open?.spec === spec) closeSoon();
    });
    // Clicking the control means the visitor has found it.
    anchor.addEventListener('click', () => {
      window.clearTimeout(openTimer);
      if (open?.spec === spec) close();
    });
    // Keyboard focus only: a mouse click focuses the button too.
    anchor.addEventListener('focusin', (event) => {
      if (event.target instanceof Element && event.target.matches(':focus-visible')) show(spec);
    });
    anchor.addEventListener('focusout', (event) => {
      const next = event.relatedTarget;
      if (open?.spec === spec && !(next instanceof Node && (anchor.contains(next) || open.node.contains(next)))) closeSoon();
    });
  }

  return {
    used(tip): void {
      const spec = specs.find((candidate) => candidate.name === tip);
      if (!spec) return;
      retire(spec);
      if (open?.spec === spec) close();
    },
    update(altitude, sandbox): void {
      if (!open) return;
      const anchor = open.spec.anchor();
      const gone = !anchor || sandbox || (open.spec.name === 'weather' && altitude > PAD_TOP);
      if (gone) close();
      else open.spec.place(open.node, anchor.getBoundingClientRect());
    },
  };
}
