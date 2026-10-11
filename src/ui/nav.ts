import { bands } from '../content';
import { progressForAltitude } from '../world/camera';
import { el, need } from './dom';

export function scrollToAltitude(
  altitude: number,
  id: string,
  reduced: () => boolean,
): void {
  const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo({
    top: progressForAltitude(altitude) * range,
    behavior: reduced() ? 'auto' : 'smooth',
  });
  history.replaceState(null, '', `#${id}`);
}

/**
 * The nav balloon's colour through the flight, one stop per layer of sky:
 * launch orange at the pad, amber and gold through the lower troposphere,
 * teal at the tropopause, stratosphere blue, indigo, then violet at the
 * edge of space. Blended in OKLab by CSS between the two stops either side.
 */
const ICON_STOPS: readonly (readonly [number, string])[] = [
  [0, '#d1521c'],
  [2500, '#e07a26'],
  [7000, '#d29a1d'],
  [12000, '#1f9a8f'],
  [18000, '#2a74c9'],
  [26000, '#4f4fc8'],
  [34000, '#8d4fc9'],
];

export class Nav {
  private readonly items: HTMLAnchorElement[] = [];
  private readonly navBands = bands.filter((band) => band.id !== 'about');
  private current = -2;
  private readonly icon: HTMLElement | null = document.querySelector('.nav__icon');
  private iconSpan = -1;
  private iconMix = -1;

  constructor(private readonly reduced: () => boolean) {
    const host = need('[data-nav]');
    for (const band of this.navBands) {
      const li = el('li');
      const item = el('a', 'nav__item', band.label);
      item.href = `#${band.id}`;
      if (band.id === 'contact') item.classList.add('nav__item--cta');
      item.addEventListener('click', (event) => {
        event.preventDefault();
        scrollToAltitude(band.altitude, band.id, this.reduced);
      });
      li.append(item);
      host.append(li);
      this.items.push(item);
    }

    const mark = need('.nav__mark');
    mark.addEventListener('click', (event) => {
      event.preventDefault();
      scrollToAltitude(0, 'top', this.reduced);
    });
  }

  update(altitude: number): void {
    this.paintIcon(altitude);
    let current = -1;
    for (let i = 0; i < this.navBands.length; i++) {
      if (altitude >= this.navBands[i].from - 1200) current = i;
    }
    if (current === this.current) return;
    this.current = current;
    for (let i = 0; i < this.items.length; i++) {
      this.items[i].classList.toggle('is-current', i === current);
    }
  }

  /** Publish the two stops around this altitude and the mix between them. */
  private paintIcon(altitude: number): void {
    if (!this.icon) return;
    let span = 0;
    while (span < ICON_STOPS.length - 2 && altitude > ICON_STOPS[span + 1][0]) span++;
    const [fromAlt, from] = ICON_STOPS[span];
    const [toAlt, to] = ICON_STOPS[span + 1];
    const mix = Math.min(1, Math.max(0, (altitude - fromAlt) / (toAlt - fromAlt)));
    const newSpan = span !== this.iconSpan;
    if (newSpan) {
      this.iconSpan = span;
      this.icon.style.setProperty('--icon-from', from);
      this.icon.style.setProperty('--icon-to', to);
    }
    // Style writes force a recalc, so only publish visible changes.
    if (!newSpan && Math.abs(mix - this.iconMix) < 0.01) return;
    this.iconMix = mix;
    this.icon.style.setProperty('--icon-mix', `${(mix * 100).toFixed(1)}%`);
  }
}
