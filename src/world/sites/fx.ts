import { makeBrush, rand } from '../brush';
import type { View } from '../scenery';
import type { PlateFrame } from '../terrain';
import type { Rgb, SiteFx } from './types';

/**
 * Live effects painted onto a site's plates. Positions are master-painting
 * pixels mapped through the plate's frame, so an effect rides its plate's
 * parallax. Everything reads the shared wind (the windsock's), and under
 * reduced motion each effect holds one still frame.
 */

type Fx<K extends SiteFx['kind']> = Extract<SiteFx, { kind: K }>;

interface Particles {
  x: Float32Array;
  y: Float32Array;
  age: Float32Array;
  life: Float32Array;
  size: Float32Array;
}

const PLATE_WIDTH = 2172;
const FLAG_COLORS = ['#3d6aa8', '#e6e2d6', '#b8453a', '#4a8a57', '#d9b545'];

function particles(count: number): Particles {
  return {
    x: new Float32Array(count),
    y: new Float32Array(count),
    age: new Float32Array(count),
    life: new Float32Array(count),
    size: new Float32Array(count),
  };
}

function rgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
}

export class SiteEffects {
  private readonly soft = makeBrush(64, 0.12, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  private readonly shadow = makeBrush(64, 0.25, 'rgba(26,34,58,1)', 'rgba(26,34,58,0)');
  private readonly tinted = new Map<string, HTMLCanvasElement>();
  private readonly state = new Map<SiteFx, Particles>();
  private readonly random = rand(20261011);
  private lastTime = -1;
  private dt = 0;

  constructor(private readonly density: number) {}

  /** Call once per scenery draw, before any effect. */
  tick(v: View): void {
    this.dt = this.lastTime < 0 || v.reduced ? 0 : Math.min(0.1, Math.max(0, v.time - this.lastTime));
    this.lastTime = v.time;
  }

  draw(ctx: CanvasRenderingContext2D, fx: SiteFx, f: PlateFrame, v: View): void {
    if (f.alpha <= 0.01) return;
    ctx.save();
    switch (fx.kind) {
      case 'cloud-shadows': this.cloudShadows(ctx, fx, f, v); break;
      case 'dust': this.dust(ctx, fx, f, v); break;
      case 'dust-devil': this.dustDevil(ctx, fx, f, v); break;
      case 'grass': this.grass(ctx, fx, f, v); break;
      case 'spindrift': this.spindrift(ctx, fx, f, v); break;
      case 'fog-bank': this.fogBank(ctx, fx, f, v); break;
      case 'summit-plume': this.summitPlume(ctx, fx, f, v); break;
      case 'prayer-flags': this.prayerFlags(ctx, fx, f, v); break;
      case 'beacon': this.beacon(ctx, fx, f, v); break;
      case 'anemometer': this.anemometer(ctx, fx, f, v); break;
      case 'birds': this.birds(ctx, fx, f, v); break;
    }
    ctx.restore();
  }

  private time(v: View): number {
    return v.reduced ? 0 : v.time;
  }

  private brushIn(color: Rgb): HTMLCanvasElement {
    const key = color.join();
    let brush = this.tinted.get(key);
    if (!brush) {
      brush = makeBrush(64, 0.1, rgba(color, 1), rgba(color, 0));
      this.tinted.set(key, brush);
    }
    return brush;
  }

  private pool(fx: SiteFx, count: number, spawn: (p: Particles, i: number) => void): Particles {
    let p = this.state.get(fx);
    if (!p) {
      p = particles(Math.max(1, Math.round(count * this.density)));
      for (let i = 0; i < p.x.length; i++) {
        spawn(p, i);
        p.age[i] = this.random() * p.life[i];
      }
      this.state.set(fx, p);
    }
    return p;
  }

  /** Soft cumulus shadows sliding across the ground with the wind. */
  private cloudShadows(ctx: CanvasRenderingContext2D, fx: Fx<'cloud-shadows'>, f: PlateFrame, v: View): void {
    const horizon = f.top + fx.groundTop * f.scale;
    if (horizon > v.height) return;
    ctx.beginPath();
    ctx.rect(-40, horizon, v.width + 80, v.height - horizon + 40);
    ctx.clip();
    const t = this.time(v);
    const speed = 10 + v.windStrength * 36;
    const span = PLATE_WIDTH + 1600;
    const depth = 724 - fx.groundTop;
    for (let i = 0; i < 5; i++) {
      const d = 0.15 + ((i * 0.37) % 1) * 0.85;
      let x = (i * 911 + t * speed * (0.35 + d)) % span;
      x -= 800;
      const y = fx.groundTop + depth * d * d;
      const width = (240 + 1100 * d) * f.scale;
      const height = width * (0.05 + 0.13 * d);
      ctx.globalAlpha = fx.strength * f.alpha;
      ctx.drawImage(this.shadow, f.left + x * f.scale - width / 2, f.top + y * f.scale - height / 2, width, height);
    }
  }

  /** Grit lifting off the apron and streaming downwind. */
  private dust(ctx: CanvasRenderingContext2D, fx: Fx<'dust'>, f: PlateFrame, v: View): void {
    const r = this.random;
    const spawn = (p: Particles, i: number): void => {
      p.x[i] = r() * PLATE_WIDTH;
      p.y[i] = fx.top + r() * (fx.bottom - fx.top);
      p.life[i] = 3 + r() * 4;
      p.age[i] = 0;
      p.size[i] = 10 + r() * 22;
    };
    const p = this.pool(fx, 34, spawn);
    const brush = this.brushIn(fx.color);
    const drift = 18 + v.windStrength * 120;
    for (let i = 0; i < p.x.length; i++) {
      p.age[i] += this.dt;
      if (p.age[i] > p.life[i]) spawn(p, i);
      p.x[i] += drift * this.dt;
      p.y[i] -= (3 + p.size[i] * 0.2) * this.dt;
      const life = p.age[i] / p.life[i];
      const near = (p.y[i] - fx.top) / (fx.bottom - fx.top);
      const size = p.size[i] * (0.6 + near) * (0.7 + life * 0.8) * f.scale;
      ctx.globalAlpha = f.alpha * Math.sin(Math.PI * life) * (0.1 + v.windStrength * 0.22);
      ctx.drawImage(brush, f.left + p.x[i] * f.scale - size * 1.6, f.top + p.y[i] * f.scale - size * 0.5, size * 3.2, size);
    }
  }

  /** A faint dust devil wandering across the basin now and then. */
  private dustDevil(ctx: CanvasRenderingContext2D, fx: Fx<'dust-devil'>, f: PlateFrame, v: View): void {
    const t = v.reduced ? 7 : v.time;
    const period = 26;
    const cycle = Math.floor(t / period);
    const local = t - cycle * period;
    const active = 11;
    if (local > active) return;
    const envelope = Math.sin((Math.PI * local) / active);
    const startX = 300 + ((cycle * 677) % 1500);
    const baseX = startX + local * 26;
    const brush = this.brushIn(fx.color);
    for (let k = 0; k < 16; k++) {
      const h = k / 15;
      const sway = Math.sin(t * 5 + k * 0.8) * (2 + h * 9) + h * h * 22;
      const radius = (3 + h * 15) * f.scale;
      const x = f.left + (baseX + sway) * f.scale;
      const y = f.top + (fx.y - h * 120) * f.scale;
      ctx.globalAlpha = f.alpha * envelope * 0.16 * (1 - h * 0.7);
      ctx.drawImage(brush, x - radius, y - radius * 0.8, radius * 2, radius * 1.6);
    }
  }

  /** Stubble and grass blades in the foreground, leaning into the gusts. */
  private grass(ctx: CanvasRenderingContext2D, fx: Fx<'grass'>, f: PlateFrame, v: View): void {
    const r = this.random;
    const p = this.pool(fx, 230, (q, i) => {
      q.x[i] = r() * PLATE_WIDTH;
      q.y[i] = fx.top + Math.sqrt(r()) * (fx.bottom - fx.top);
      q.size[i] = r();
      q.life[i] = 1;
    });
    const t = this.time(v);
    const lean = 0.12 + v.windStrength * 0.55;
    const colors = ['rgba(150,132,78,0.7)', 'rgba(96,106,62,0.7)', 'rgba(184,166,108,0.6)', 'rgba(120,100,62,0.65)'];
    ctx.lineCap = 'round';
    for (let c = 0; c < colors.length; c++) {
      ctx.strokeStyle = colors[c];
      ctx.globalAlpha = f.alpha;
      ctx.lineWidth = Math.max(0.8, 1.1 * f.scale);
      ctx.beginPath();
      for (let i = c; i < p.x.length; i += colors.length) {
        const near = (p.y[i] - fx.top) / (fx.bottom - fx.top);
        const length = (5 + near * 18 + p.size[i] * 8) * f.scale;
        const sway = Math.sin(t * 2.1 + p.x[i] * 0.011) * 0.5 + Math.sin(t * 5.3 + p.x[i] * 0.07) * 0.18;
        const bend = length * (lean + sway * (0.12 + v.windStrength * 0.3));
        const x = f.left + p.x[i] * f.scale;
        const y = f.top + p.y[i] * f.scale;
        if (y > v.height + 4) continue;
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + bend * 0.2, y - length * 0.6, x + bend, y - length * (1 - Math.abs(lean) * 0.25));
      }
      ctx.stroke();
    }
  }

  /** Loose snow streaming low over the ground. */
  private spindrift(ctx: CanvasRenderingContext2D, fx: Fx<'spindrift'>, f: PlateFrame, v: View): void {
    const r = this.random;
    const spawn = (p: Particles, i: number): void => {
      p.x[i] = r() * PLATE_WIDTH;
      p.y[i] = fx.top + r() * (fx.bottom - fx.top);
      p.life[i] = 1.2 + r() * 2;
      p.age[i] = 0;
      p.size[i] = 0.5 + r();
    };
    const p = this.pool(fx, 110, spawn);
    const speed = 70 + v.windStrength * 320;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, 1.3 * f.scale);
    for (let i = 0; i < p.x.length; i++) {
      p.age[i] += this.dt;
      if (p.age[i] > p.life[i]) spawn(p, i);
      p.x[i] += speed * p.size[i] * this.dt;
      p.y[i] += Math.sin(p.age[i] * 7 + i) * 6 * this.dt;
      const life = p.age[i] / p.life[i];
      const length = (4 + speed * 0.05 * p.size[i]) * f.scale;
      const x = f.left + p.x[i] * f.scale;
      const y = f.top + p.y[i] * f.scale;
      ctx.globalAlpha = f.alpha * Math.sin(Math.PI * life) * (0.2 + v.windStrength * 0.45);
      ctx.beginPath();
      ctx.moveTo(x - length, y + length * 0.06);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  /** A low fog bank lying in the folds of the far hills. */
  private fogBank(ctx: CanvasRenderingContext2D, fx: Fx<'fog-bank'>, f: PlateFrame, v: View): void {
    const t = this.time(v);
    const thickness = fx.thickness * f.scale;
    const span = PLATE_WIDTH * 1.4;
    for (let k = 0; k < 22; k++) {
      const seed = (k * 0.618) % 1;
      let x = (k / 22) * span + t * (4 + v.windStrength * 10) * (0.6 + seed * 0.6);
      x = (x % span) - PLATE_WIDTH * 0.2;
      const y = fx.y + Math.sin(k * 2.3) * fx.thickness * 0.35;
      const width = (180 + seed * 260) * f.scale;
      ctx.globalAlpha = f.alpha * (0.32 + seed * 0.22);
      ctx.drawImage(this.soft, f.left + x * f.scale - width / 2, f.top + y * f.scale - thickness / 2, width, thickness);
    }
  }

  /** The banner cloud streaming off the summit to leeward. */
  private summitPlume(ctx: CanvasRenderingContext2D, fx: Fx<'summit-plume'>, f: PlateFrame, v: View): void {
    const t = this.time(v);
    const count = 28;
    const reach = 380 + v.windStrength * 220;
    for (let k = 0; k < count; k++) {
      const s = (k / count + t * 0.035) % 1;
      const x = fx.x + s * reach + Math.sin(t * 0.7 + k) * 6 * s;
      const y = fx.y + 4 + s * 50 + Math.sin(t * 0.9 + k * 1.7) * 4 * s;
      const radius = (6 + s * 52) * f.scale;
      ctx.globalAlpha = f.alpha * 0.5 * Math.min(1, s * 25) * (1 - s) * (1 - s);
      ctx.drawImage(this.soft, f.left + x * f.scale - radius, f.top + y * f.scale - radius * 0.45, radius * 2, radius * 0.9);
    }
  }

  /** A string of prayer flags between two poles, fluttering downwind. */
  private prayerFlags(ctx: CanvasRenderingContext2D, fx: Fx<'prayer-flags'>, f: PlateFrame, v: View): void {
    const t = this.time(v);
    const [ax, ay] = fx.from;
    const [bx, by] = fx.to;
    const map = (x: number, y: number): [number, number] => [f.left + x * f.scale, f.top + y * f.scale];
    const pole = 24;
    ctx.globalAlpha = f.alpha;
    ctx.strokeStyle = 'rgba(60,52,44,0.9)';
    ctx.lineWidth = Math.max(1, 1.2 * f.scale);
    ctx.beginPath();
    for (const [x, y] of [fx.from, fx.to]) {
      const [sx, sy] = map(x, y);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + pole * f.scale);
    }
    ctx.stroke();
    const flags = 24;
    const lift = 0.25 + v.windStrength * 0.75;
    ctx.lineWidth = Math.max(0.6, 0.6 * f.scale);
    ctx.beginPath();
    for (let i = 0; i <= flags; i++) {
      const u = i / flags;
      const [sx, sy] = map(ax + (bx - ax) * u, ay + (by - ay) * u + fx.sag * Math.sin(Math.PI * u));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    const w = 3.6 * f.scale;
    const h = 4.4 * f.scale;
    for (let i = 1; i < flags; i++) {
      const u = i / flags;
      const [sx, sy] = map(ax + (bx - ax) * u, ay + (by - ay) * u + fx.sag * Math.sin(Math.PI * u));
      const flutter = Math.sin(t * 9 + i * 1.3) * 0.35 + Math.sin(t * 15 + i) * 0.15;
      const skew = (lift + flutter * lift) * w;
      ctx.fillStyle = FLAG_COLORS[i % FLAG_COLORS.length];
      ctx.beginPath();
      ctx.moveTo(sx - w / 2, sy);
      ctx.lineTo(sx + w / 2, sy);
      ctx.lineTo(sx + w / 2 + skew, sy + h * (1 - lift * 0.4));
      ctx.lineTo(sx - w / 2 + skew, sy + h * (1 - lift * 0.4));
      ctx.closePath();
      ctx.fill();
    }
  }

  /** A red obstruction light, blinking. */
  private beacon(ctx: CanvasRenderingContext2D, fx: Fx<'beacon'>, f: PlateFrame, v: View): void {
    const phase = (v.time / 1.7 + fx.phase) % 1;
    const on = v.reduced ? 0.6 : Math.max(0, 1 - phase * 3.2);
    const x = f.left + fx.x * f.scale;
    const y = f.top + fx.y * f.scale;
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = `rgba(150,28,24,${0.7 + on * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, 1.8 * f.scale), 0, 6.283);
    ctx.fill();
    if (on <= 0.02) return;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 12 * f.scale);
    glow.addColorStop(0, `rgba(255,70,50,${0.85 * on})`);
    glow.addColorStop(1, 'rgba(255,70,50,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 12 * f.scale, y - 12 * f.scale, 24 * f.scale, 24 * f.scale);
  }

  /** Three cups spinning at wind speed on the tower's boom. */
  private anemometer(ctx: CanvasRenderingContext2D, fx: Fx<'anemometer'>, f: PlateFrame, v: View): void {
    const spin = this.time(v) * (3 + v.windStrength * 16);
    const cx = f.left + fx.x * f.scale;
    const cy = f.top + fx.y * f.scale;
    const arm = 6 * f.scale;
    ctx.globalAlpha = f.alpha;
    ctx.strokeStyle = 'rgba(52,56,60,0.9)';
    ctx.fillStyle = 'rgba(40,42,46,0.95)';
    ctx.lineWidth = Math.max(0.7, 0.8 * f.scale);
    for (let k = 0; k < 3; k++) {
      const angle = spin + (k * 2 * Math.PI) / 3;
      const x = cx + Math.cos(angle) * arm;
      const y = cy + Math.sin(angle) * arm * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.9, 1.5 * f.scale), 0, 6.283);
      ctx.fill();
    }
  }

  /** A few birds crossing the far field. */
  private birds(ctx: CanvasRenderingContext2D, fx: Fx<'birds'>, f: PlateFrame, v: View): void {
    const t = this.time(v);
    const span = PLATE_WIDTH + 600;
    ctx.globalAlpha = f.alpha * 0.8;
    ctx.strokeStyle = 'rgb(44,44,50)';
    ctx.lineWidth = Math.max(1, 1.3 * f.scale);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < fx.count; i++) {
      let x = (i * 47 + t * 34 + Math.sin(t * 0.4 + i) * 20) % span;
      x -= 300;
      const y = fx.y + Math.sin(i * 2.1) * 26 + Math.sin(t * 0.8 + i * 1.3) * 8;
      const wing = (5 + (i % 2)) * f.scale;
      const flap = Math.sin(t * 9 + i * 2.4) * 0.8;
      const sx = f.left + x * f.scale;
      const sy = f.top + y * f.scale;
      ctx.moveTo(sx - wing, sy - wing * flap * 0.6);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx + wing, sy - wing * flap * 0.6);
    }
    ctx.stroke();
  }
}
