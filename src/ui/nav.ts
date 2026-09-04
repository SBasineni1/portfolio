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

export class Nav {
  private readonly items: HTMLAnchorElement[] = [];
  private readonly navBands = bands.filter((band) => band.id !== 'about');
  private current = -2;

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
}
