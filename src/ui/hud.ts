import { bands } from '../content';
import { atmosphereAt } from '../world/atmosphere';
import { MAX_ALTITUDE, progressForAltitude } from '../world/camera';

/**
 * Telemetry strip + the altitude tape down the right edge. The tape is linear
 * in altitude (not in scroll), so the tick spacing means something.
 */

const TICK_MINOR = 2500;
const TICK_MAJOR = 5000;

export type Phase = 'PAD HOLD' | 'RELEASE' | 'ASCENT' | 'BURST' | 'CHUTE DESCENT';

export class Hud {
  private readonly alt: HTMLElement;
  private readonly temp: HTMLElement;
  private readonly pres: HTMLElement;
  private readonly rate: HTMLElement;
  private readonly phase: HTMLElement;
  private readonly sled: HTMLElement;
  private readonly ticks: HTMLElement;
  private readonly stopsHost: HTMLElement;
  private readonly stops: HTMLElement[] = [];

  private next = 0;
  private lastPhase = '';
  private trackTop = 0;
  private trackHeight = 0;

  constructor(private readonly reducedMotion: () => boolean) {
    this.alt = need('[data-hud-alt]');
    this.temp = need('[data-hud-temp]');
    this.pres = need('[data-hud-pres]');
    this.rate = need('[data-hud-rate]');
    this.phase = need('[data-hud-phase]');
    this.sled = need('[data-tape-sled]');
    this.ticks = need('[data-tape-ticks]');
    this.stopsHost = need('[data-tape-stops]');
    this.buildTape();
  }

  private buildTape(): void {
    for (let a = 0; a <= MAX_ALTITUDE; a += TICK_MINOR) {
      const major = a % TICK_MAJOR === 0;
      const tick = document.createElement('div');
      tick.className = `tick ${major ? 'tick--major' : 'tick--minor'}`;
      tick.style.top = `${(1 - a / MAX_ALTITUDE) * 100}%`;
      if (major) {
        const label = document.createElement('span');
        label.className = 'tick__label';
        label.textContent = `${a / 1000} KM`;
        tick.append(label);
      }
      this.ticks.append(tick);
    }

    for (const band of bands) {
      const li = document.createElement('li');
      li.className = 'tape__stop';
      li.style.top = `${(1 - band.altitude / MAX_ALTITUDE) * 100}%`;
      const a = document.createElement('a');
      a.href = `#${band.id}`;
      a.textContent = band.label;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        window.scrollTo({
          top: progressForAltitude(band.altitude) * range,
          behavior: this.reducedMotion() ? 'auto' : 'smooth',
        });
        history.replaceState(null, '', `#${band.id}`);
      });
      li.append(a);
      this.stopsHost.append(li);
      this.stops.push(li);
    }
  }

  /** Cache the tape track geometry; called on resize, not per frame. */
  layout(): void {
    const box = this.ticks.getBoundingClientRect();
    this.trackTop = box.top;
    this.trackHeight = box.height;
  }

  update(now: number, altitude: number, ascentRate: number, phase: Phase): void {
    const frac = Math.min(1, Math.max(0, altitude / MAX_ALTITUDE));
    this.sled.style.top = `${this.trackTop + (1 - frac) * this.trackHeight}px`;

    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.phase.textContent = phase;
    }

    if (now < this.next) return;
    this.next = now + 0.09;

    const air = atmosphereAt(altitude);
    this.alt.textContent = `${Math.round(altitude).toLocaleString('en-US')} M`;
    this.temp.textContent = `${air.temperature >= 0 ? '+' : '−'}${Math.abs(air.temperature).toFixed(1)} °C`;
    this.pres.textContent = `${air.pressure >= 100 ? air.pressure.toFixed(0) : air.pressure.toFixed(1)} hPa`;
    this.rate.textContent = `${ascentRate >= 0 ? '+' : '−'}${Math.abs(ascentRate).toFixed(1)} M/S`;

    let current = 0;
    for (let i = 0; i < bands.length; i++) {
      if (altitude >= bands[i].from - 1200) current = i;
    }
    for (let i = 0; i < this.stops.length; i++) {
      this.stops[i].classList.toggle('is-current', i === current);
    }
  }
}

function need(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node;
}
