import { groundScreenY, type View } from './scenery';
import type { LaunchSite } from './sites/types';

/**
 * Weather under the clouds, off until the visitor turns it on (it would
 * otherwise compete with the page). Once on, each launch site rolls from its
 * own odds whenever it loads, always coming up with something falling: the
 * visitor asked for weather, so a roll never answers "clear".
 *
 * Precipitation falls from the site's cloud base (the overcast deck at the
 * plains, the low cloud layer elsewhere), so it fills the pad and About and
 * thins out as the balloon climbs to the base, then stops: above the clouds
 * it is not raining. Rain leans with the surface wind, snow drifts and
 * swirls, a storm adds soft lightning (never faster than one double flicker
 * every few seconds) and gusts. Wet or snow-loaded, the envelope is pushed
 * down a little; nothing strong enough to fight a drag.
 *
 * Everything is screen-space and lives on the scene canvas: one capped pool
 * of particles, a pass for far drops and a pass for near ones. Clear, or
 * above the base, nothing runs. Under reduced motion nothing falls or
 * flashes and the balloon is left alone; the sky still dims and the site tag
 * still names the conditions.
 */

export type WeatherKind = 'clear' | 'drizzle' | 'rain' | 'storm' | 'flurries' | 'snow';

/** A site's climate: the chance of each kind (the rest is clear) and where its cloud base sits. */
export interface SiteWeather {
  odds: Partial<Record<Exclude<WeatherKind, 'clear'>, number>>;
  /** Cloud base, metres. Precipitation falls below it. */
  base: number;
}

interface Profile {
  label: string;
  fall: 'none' | 'rain' | 'snow';
  /** Fraction of the particle pool in use. */
  density: number;
  /** Fall speed of the nearest particles, px/s. */
  speed: number;
  /** Streak length of the nearest rain, px. */
  length: number;
  alpha: number;
  /** Downward push on the balloon, px/s² (wind runs ~±150 at the surface). */
  push: number;
  /** Grey wash over the scene, 0..1. */
  dim: number;
  lightning: boolean;
  gusts: boolean;
}

const PROFILES: Record<WeatherKind, Profile> = {
  clear: { label: 'Clear', fall: 'none', density: 0, speed: 0, length: 0, alpha: 0, push: 0, dim: 0, lightning: false, gusts: false },
  drizzle: { label: 'Drizzle', fall: 'rain', density: 0.45, speed: 640, length: 9, alpha: 0.3, push: 18, dim: 0.07, lightning: false, gusts: false },
  rain: { label: 'Rain', fall: 'rain', density: 0.85, speed: 1080, length: 19, alpha: 0.36, push: 42, dim: 0.13, lightning: false, gusts: false },
  storm: { label: 'Thunderstorm', fall: 'rain', density: 1, speed: 1320, length: 25, alpha: 0.42, push: 58, dim: 0.22, lightning: true, gusts: true },
  flurries: { label: 'Snow flurries', fall: 'snow', density: 0.35, speed: 70, length: 0, alpha: 0.85, push: 10, dim: 0.04, lightning: false, gusts: false },
  snow: { label: 'Snow', fall: 'snow', density: 0.85, speed: 95, length: 0, alpha: 0.9, push: 24, dim: 0.1, lightning: false, gusts: false },
};

/** Every kind a site can roll, in a fixed order so a roll is repeatable. */
const ROLLABLE: Exclude<WeatherKind, 'clear'>[] = ['drizzle', 'rain', 'storm', 'flurries', 'snow'];

/** What the sandbox's Weather button steps through. */
export const WEATHER_CYCLE: WeatherKind[] = ['clear', 'drizzle', 'rain', 'storm', 'snow'];

/** Metres below the base over which the weather thins to nothing. */
const BASE_FADE = 260;
/** Rain streaks lean with the wind: surface wind (px/s²) to sideways drift (px/s). */
const RAIN_LEAN = 2.4;
const SNOW_LEAN = 1.3;

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export class Weather {
  private kind: WeatherKind = 'clear';
  private enabled = false;
  private base = 1100;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  /** Depth 0.35 (far) .. 1 (near): speed, size and alpha all scale with it. */
  private readonly z: Float32Array;
  private active = 0;
  private lastGround = Number.NaN;
  private width = 0;
  private height = 0;
  private time = 0;
  private wind = 0;
  private presenceNow = 0;
  /** Seconds into the current flash, or negative while waiting. */
  private flashAge = -1;
  private nextFlash = 4;
  private nextGust = 3;

  constructor(private readonly max: number) {
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.z = new Float32Array(max);
  }

  /** Roll this site's weather (clear while weather is off). */
  roll(site: LaunchSite, random: () => number = Math.random): void {
    this.base = site.weather.base;
    if (!this.enabled) {
      this.reset('clear');
      return;
    }
    // Only the kinds this site can have, weighted by its odds.
    const total = ROLLABLE.reduce((sum, kind) => sum + (site.weather.odds[kind] ?? 0), 0);
    let r = random() * total;
    let picked: WeatherKind = 'clear';
    for (const kind of ROLLABLE) {
      const odds = site.weather.odds[kind] ?? 0;
      if (odds > 0 && r < odds) {
        picked = kind;
        break;
      }
      r -= odds;
    }
    this.reset(picked);
  }

  /** Turn weather on (rolling for `site`) or off. */
  setEnabled(enabled: boolean, site: LaunchSite): void {
    this.enabled = enabled;
    this.roll(site);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Force a kind (the sandbox); this turns weather on. */
  set(kind: WeatherKind): void {
    this.enabled = true;
    this.reset(kind);
  }

  private reset(kind: WeatherKind): void {
    this.kind = kind;
    this.flashAge = -1;
    this.nextFlash = 2 + Math.random() * 4;
    this.nextGust = 2 + Math.random() * 3;
    // Scatter the pool over the frame so a change starts mid-shower, not from the top.
    for (let i = 0; i < this.max; i++) {
      this.x[i] = Math.random() * (this.width || 1);
      this.y[i] = Math.random() * (this.height || 1);
      this.z[i] = 0.35 + Math.random() * 0.65;
    }
  }

  get current(): WeatherKind {
    return this.kind;
  }

  get label(): string {
    return this.enabled ? PROFILES[this.kind].label : 'Weather off';
  }

  /** 0..1: how much of the weather reaches this altitude. */
  presence(altitude: number): number {
    return smooth((this.base - altitude) / BASE_FADE);
  }

  /** Downward push on the balloon at this altitude, px/s². */
  push(altitude: number, reduced: boolean): number {
    return reduced ? 0 : PROFILES[this.kind].push * this.presence(altitude);
  }

  /**
   * Advance the drops and the lightning. `windX` is the surface wind
   * (px/s²); `gust` is called when a storm shoves the balloon.
   */
  update(dt: number, v: View, windX: number, reduced: boolean, gust: (strength: number, dir: number) => void): void {
    const p = PROFILES[this.kind];
    this.time += dt;
    this.wind = windX;
    this.presenceNow = this.presence(v.altitude);
    if (v.width !== this.width || v.height !== this.height) {
      const sx = this.width > 0 ? v.width / this.width : 1;
      const sy = this.height > 0 ? v.height / this.height : 1;
      for (let i = 0; i < this.max; i++) {
        this.x[i] = this.width > 0 ? this.x[i] * sx : Math.random() * v.width;
        this.y[i] = this.height > 0 ? this.y[i] * sy : Math.random() * v.height;
      }
      this.width = v.width;
      this.height = v.height;
    }
    // The ground's screen height moves as the balloon climbs; drops ride it a
    // little so the shower stays in the world rather than glued to the glass.
    const ground = groundScreenY(v.altitude, v.height);
    const shift = Number.isNaN(this.lastGround) ? 0 : ground - this.lastGround;
    this.lastGround = ground;

    this.active = reduced || p.fall === 'none' ? 0 : Math.round(this.max * p.density * this.presenceNow);
    const lean = (p.fall === 'snow' ? SNOW_LEAN : RAIN_LEAN) * windX;
    for (let i = 0; i < this.active; i++) {
      const z = this.z[i];
      const depth = 0.55 + 0.45 * z;
      let vx = lean * depth;
      if (p.fall === 'snow') vx += Math.sin(this.time * 1.3 + i * 1.7) * 26 * z;
      this.x[i] += vx * dt;
      this.y[i] += p.speed * depth * dt + shift * (0.3 + 0.7 * z);
      if (this.y[i] > v.height + 30) {
        this.y[i] = -30 - Math.random() * 60;
        this.x[i] = Math.random() * v.width;
      } else if (this.y[i] < -120) {
        this.y[i] = v.height + Math.random() * 20;
      }
      if (this.x[i] < -40) this.x[i] += v.width + 80;
      else if (this.x[i] > v.width + 40) this.x[i] -= v.width + 80;
    }

    if (!p.lightning || reduced || this.presenceNow <= 0.05) {
      this.flashAge = -1;
    } else if (this.flashAge >= 0) {
      this.flashAge += dt;
      if (this.flashAge > 0.6) {
        this.flashAge = -1;
        this.nextFlash = 5 + Math.random() * 9;
      }
    } else {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) this.flashAge = 0;
    }

    if (p.gusts && !reduced && this.presenceNow > 0.5) {
      this.nextGust -= dt;
      if (this.nextGust <= 0) {
        this.nextGust = 3 + Math.random() * 4;
        gust(0.5 + Math.random() * 0.5, Math.random() < 0.5 ? -1 : 1);
      }
    }
  }

  /** Two soft pulses, the second smaller: 0..1. */
  private flash(): number {
    const t = this.flashAge;
    if (t < 0) return 0;
    const pulse = (start: number, peak: number): number => {
      const u = t - start;
      if (u < 0) return 0;
      return u < 0.06 ? (u / 0.06) * peak : peak * Math.exp(-(u - 0.06) * 9);
    };
    return Math.max(pulse(0, 1), pulse(0.2, 0.6));
  }

  /** Behind the balloon: the grey wash. */
  drawBack(ctx: CanvasRenderingContext2D, v: View): void {
    const p = PROFILES[this.kind];
    const presence = this.presenceNow;
    if (presence <= 0 || this.kind === 'clear') return;
    ctx.save();
    if (p.dim > 0) {
      ctx.fillStyle = `rgba(48, 56, 68, ${(p.dim * presence).toFixed(3)})`;
      ctx.fillRect(0, 0, v.width, v.height);
    }
    ctx.restore();
  }

  /** In front of the balloon: the precipitation and an overhead flash. */
  drawFront(ctx: CanvasRenderingContext2D, v: View): void {
    const p = PROFILES[this.kind];
    if (this.presenceNow <= 0 || this.kind === 'clear') return;
    ctx.save();
    if (this.active > 0 && p.fall === 'rain') {
      const lean = RAIN_LEAN * this.wind;
      ctx.lineCap = 'round';
      for (const near of [false, true]) {
        ctx.beginPath();
        for (let i = 0; i < this.active; i++) {
          const z = this.z[i];
          if (z >= 0.7 !== near) continue;
          const depth = 0.55 + 0.45 * z;
          const len = p.length * depth;
          const dx = (lean * depth) / (p.speed * depth) * len;
          ctx.moveTo(this.x[i], this.y[i]);
          ctx.lineTo(this.x[i] - dx, this.y[i] - len);
        }
        ctx.lineWidth = near ? 1.4 : 0.9;
        ctx.strokeStyle = `rgba(214, 224, 238, ${(p.alpha * (near ? 1 : 0.6)).toFixed(3)})`;
        ctx.stroke();
      }
    } else if (this.active > 0 && p.fall === 'snow') {
      for (const near of [false, true]) {
        ctx.beginPath();
        for (let i = 0; i < this.active; i++) {
          const z = this.z[i];
          if (z >= 0.7 !== near) continue;
          const r = 0.8 + 2.3 * z;
          ctx.moveTo(this.x[i] + r, this.y[i]);
          ctx.arc(this.x[i], this.y[i], r, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${(p.alpha * (near ? 1 : 0.55)).toFixed(3)})`;
        ctx.fill();
      }
    }
    if (p.lightning) {
      const f = this.flash();
      if (f > 0) {
        const light = ctx.createLinearGradient(0, 0, 0, v.height * 0.75);
        light.addColorStop(0, `rgba(240, 240, 255, ${0.3 * f * this.presenceNow})`);
        light.addColorStop(1, 'rgba(240, 240, 255, 0)');
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, v.width, v.height * 0.75);
      }
    }
    ctx.restore();
  }
}
