import { MAX_ALTITUDE } from '../world/camera';
import { need } from './dom';

const TICK = 250;
const LABEL = 1000;
const PX_PER_M = 0.072;
const STRIP_H = MAX_ALTITUDE * PX_PER_M;

export class AltTape {
  private readonly host: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly value: HTMLElement;
  private centre = 0;
  private lastY = Number.NaN;
  private lastM = -1;
  private next = 0;

  constructor() {
    this.host = need('.alt');
    this.strip = need('[data-alt-strip]');
    this.value = need('[data-alt-value]');
    this.buildStrip();
  }

  private buildStrip(): void {
    for (let a = 0; a <= MAX_ALTITUDE; a += TICK) {
      const major = a % LABEL === 0;
      const tick = document.createElement('div');
      tick.className = `alt__tick alt__tick--${major ? 'major' : 'minor'}`;
      tick.style.top = `${(MAX_ALTITUDE - a) * PX_PER_M}px`;
      if (major) {
        const label = document.createElement('span');
        label.className = 'alt__label';
        if (a % 5000 === 0) label.classList.add('alt__label--5k');
        label.textContent = String(a / 1000);
        tick.append(label);
      }
      this.strip.append(tick);
    }

    const ground = document.createElement('div');
    ground.className = 'alt__ground';
    ground.style.top = `${STRIP_H}px`;
    ground.style.height = '600px';
    this.strip.append(ground);
  }

  layout(): void {
    this.centre = this.host.clientHeight / 2;
  }

  update(now: number, altitude: number): void {
    const a = Math.min(MAX_ALTITUDE, Math.max(0, altitude));
    const y = Math.round(this.centre - (MAX_ALTITUDE - a) * PX_PER_M);
    if (y !== this.lastY) {
      this.lastY = y;
      this.strip.style.transform = `translate3d(0,${y}px,0)`;
    }

    const m = Math.round(a);
    if (now >= this.next && m !== this.lastM) {
      this.next = now + 0.09;
      this.lastM = m;
      this.value.textContent = fmt(m);
    }
  }
}

function fmt(metres: number): string {
  const digits = String(metres);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, -3)}\u2009${digits.slice(-3)}`;
}
