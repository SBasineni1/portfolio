import { SITES, rememberSite, siteIndex, type LaunchSite } from '../world/sites';
import { EASE_OUT, gsap } from './motion';

/** How close (px) the picker may come to the launch note before it lifts. */
const CLEARANCE = 10;

export interface SitePicker {
  /** Fade signal from the flight; the picker goes inert once the launch is under way. */
  setLaunch(launch: number): void;
  /** The site the scene actually settled on (a failed load reverts it). */
  follow(site: LaunchSite): void;
  /** True while the chosen site's plates are still downloading or decoding. */
  setLoading(loading: boolean): void;
}

/**
 * Bottom-left launch-site switcher. Pad-only chrome: it fades with --launch
 * and goes inert once the flight starts. Arrow keys step sites while focus is
 * inside; neighbours preload on hover or focus so a switch is usually instant.
 *
 * Motion (GSAP, skipped under reduced motion): the slab rises in after the
 * hero, the buttons pop in after it; a switch slides the old name out and the
 * new one in from the direction of travel, rolls the count and nudges the
 * arrow pressed; a hairline sweeps under the slab while plates load.
 */
export function mountSitePicker(
  initial: LaunchSite,
  show: (site: LaunchSite) => void,
  preload: (site: LaunchSite) => void,
  reduced: () => boolean,
): SitePicker {
  const root = document.querySelector<HTMLElement>('[data-site-picker]');
  if (!root) return { setLaunch: () => undefined, follow: () => undefined, setLoading: () => undefined };
  const count = root.querySelector<HTMLElement>('[data-site-count]');
  const name = root.querySelector<HTMLElement>('[data-site-name]');
  const toast = document.querySelector<HTMLElement>('[data-toast]');
  let index = siteIndex(initial);

  const prev = root.querySelector<HTMLElement>('[data-site-prev]');
  const next = root.querySelector<HTMLElement>('[data-site-next]');
  const load = document.createElement('span');
  load.className = 'site-picker__load';
  load.setAttribute('aria-hidden', 'true');
  const bar = document.createElement('span');
  load.append(bar);
  root.append(load);

  const totalNode = root.querySelector<HTMLElement>('[data-site-total]');
  if (totalNode) totalNode.textContent = `/${String(SITES.length).padStart(2, '0')}`;

  const render = (): void => {
    if (count) count.textContent = String(index + 1).padStart(2, '0');
    if (name) name.textContent = SITES[index].label;
  };

  /** Swap the readout: out against the direction of travel, in along it. */
  const animateTo = (direction: number): void => {
    if (reduced() || !name || !count) {
      render();
      return;
    }
    const button = direction > 0 ? next : prev;
    const arrow = button?.querySelector('svg');
    if (arrow) gsap.fromTo(arrow, { x: direction * 4 }, { x: 0, duration: 0.45, ease: 'back.out(3)' });
    gsap.killTweensOf([name, count]);
    gsap.timeline()
      .to(name, { x: -direction * 14, opacity: 0, duration: 0.14, ease: 'power2.in' })
      .to(count, { yPercent: -direction * 60, opacity: 0, duration: 0.14, ease: 'power2.in' }, 0)
      .add(render)
      .fromTo(name, { x: direction * 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: EASE_OUT })
      .fromTo(count, { yPercent: direction * 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: EASE_OUT }, '<');
  };

  const neighbours = (): void => {
    preload(SITES[(index + 1) % SITES.length]);
    preload(SITES[(index + SITES.length - 1) % SITES.length]);
  };

  /** Remember the site and put it in the URL so a reload or shared link lands there. */
  const record = (site: LaunchSite): void => {
    rememberSite(site);
    const url = new URL(location.href);
    url.searchParams.set('site', site.id);
    history.replaceState(history.state, '', url);
  };

  const step = (delta: number): void => {
    index = (index + delta + SITES.length) % SITES.length;
    const site = SITES[index];
    animateTo(delta);
    show(site);
    record(site);
    neighbours();
  };

  root.querySelector('[data-site-prev]')?.addEventListener('click', () => step(-1));
  root.querySelector('[data-site-next]')?.addEventListener('click', () => step(1));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else return;
    event.preventDefault();
  });
  root.addEventListener('pointerenter', neighbours, { once: true });
  root.addEventListener('focusin', neighbours, { once: true });
  // Warm the neighbours once the first site has had time to load.
  window.setTimeout(neighbours, 2500);

  // Lift above the launch note whenever the two would overlap. Offsets are
  // layout positions, so the note's entrance transform cannot skew them.
  const place = (): void => {
    root.style.removeProperty('bottom');
    // A note docked beside the balloon is nowhere near the tag.
    if (!toast?.classList.contains('is-open') || toast.classList.contains('is-docked')) return;
    if (root.offsetLeft + root.offsetWidth + CLEARANCE <= toast.offsetLeft) return;
    root.style.bottom = `${window.innerHeight - toast.offsetTop + CLEARANCE}px`;
  };
  if (toast) {
    new MutationObserver(place).observe(toast, { attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(place).observe(toast);
  }
  window.addEventListener('resize', place);

  render();
  root.hidden = false;
  place();
  if (!reduced()) {
    // Arrive just after the hero settles and before the launch note.
    gsap
      .timeline({ delay: 0.55 })
      .fromTo(root, { '--enter': 0, y: 18 }, { '--enter': 1, y: 0, duration: 0.8, ease: EASE_OUT })
      .from([prev, next], { scale: 0.6, opacity: 0, duration: 0.45, stagger: 0.08, ease: 'back.out(2.6)' }, 0.2)
      .from(root.querySelector('.site-picker__readout'), { x: -8, opacity: 0, duration: 0.6, ease: EASE_OUT }, 0.25);
  }

  let sweep: gsap.core.Tween | undefined;
  let loading = false;
  let gone = false;
  return {
    setLaunch(launch: number): void {
      const next = launch > 0.9;
      if (next === gone) return;
      gone = next;
      root.inert = gone;
    },
    follow(site: LaunchSite): void {
      const actual = siteIndex(site);
      if (actual === index || actual < 0) return;
      const direction = actual > index ? 1 : -1;
      index = actual;
      animateTo(direction);
      record(site);
    },
    setLoading(next: boolean): void {
      if (next === loading) return;
      loading = next;
      if (reduced()) return;
      gsap.killTweensOf(load);
      if (loading) {
        sweep?.kill();
        gsap.to(load, { opacity: 1, duration: 0.2 });
        sweep = gsap.fromTo(bar, { xPercent: -100 }, { xPercent: 340, duration: 0.9, ease: 'power1.inOut', repeat: -1 });
      } else {
        // Only stop the sweep this fade-out belongs to, not a newer one.
        const finished = sweep;
        gsap.to(load, { opacity: 0, duration: 0.3, onComplete: () => finished?.kill() });
      }
    },
  };
}
