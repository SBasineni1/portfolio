import type { View } from './scenery';

/**
 * Near-space starfield, after the CornellGeoData site's hero sky (Sky.tsx):
 * a dense field of white stars, the brighter ones twinkling with a soft glow,
 * a few with four-point glints, plus the occasional shooting star or slow
 * comet. Faint stars are drawn once to a tile that drifts left and wraps;
 * per frame only the twinklers and comets are drawn on top.
 *
 * Adapted to the ascent: the whole field fades in with altitude
 * (`starVisibility`), sinks slightly as you climb, and shares the wind drift
 * with the rest of the scene. Comets only fly once the sky is dark. Under
 * reduced motion nothing drifts, twinkles or streaks.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  tint: number;
  tw: number;
  ph: number;
  glint: boolean;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  width: number;
  age: number;
  life: number;
  big: boolean;
}

const TINTS = ['255,255,255', '214,228,255', '255,236,214'];
/** px per second the sky slides left: slow, but visibly moving. */
const DRIFT = 10;
/** Altitude parallax, px per metre. */
const STAR_K = 0.0022;
/** Tile is taller than the viewport so the field can sink as you climb. */
const OVERSCAN = 90;

function makeGlow(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(235,243,255,0.75)');
  grad.addColorStop(0.45, 'rgba(190,215,255,0.18)');
  grad.addColorStop(1, 'rgba(190,215,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** Two thin tapered spikes crossed: a four-point sparkle. */
function makeGlint(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) return c;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const grad = g.createLinearGradient(32 - 32 * dx, 32 - 32 * dy, 32 + 32 * dx, 32 + 32 * dy);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    if (dx) g.fillRect(0, 31.2, 64, 1.6);
    else g.fillRect(31.2, 0, 1.6, 64);
  }
  return c;
}

function makeStars(w: number, h: number, density: number): Star[] {
  const n = Math.min(1800, Math.round(((w * h) / 1000) * density));
  return Array.from({ length: n }, () => {
    const k = Math.random();
    // 75% faint pinpricks, 20% mid, 5% bright — the bright ones carry the glow.
    const r = k < 0.75 ? 0.55 + Math.random() * 0.5 : k < 0.95 ? 0.95 + Math.random() * 0.55 : 1.6 + Math.random() * 0.7;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r,
      a: k < 0.75 ? 0.4 + Math.random() * 0.5 : 0.75 + Math.random() * 0.25,
      tint: Math.random() < 0.8 ? 0 : Math.random() < 0.7 ? 1 : 2,
      tw: k < 0.75 ? 0 : 0.6 + Math.random() * 1.8,
      ph: Math.random() * Math.PI * 2,
      glint: k >= 0.95 && Math.random() < 0.35,
    };
  });
}

function spawnComet(w: number, h: number): Comet {
  const big = Math.random() < 0.25;
  // Enters over the top or right edge and heads down-left, across open sky.
  const angle = Math.PI * (big ? 0.72 : 0.68) + Math.random() * Math.PI * 0.12;
  const speed = big ? 140 + Math.random() * 90 : 520 + Math.random() * 380;
  const fromTop = Math.random() < 0.6;
  return {
    x: fromTop ? w * (0.35 + Math.random() * 0.7) : w + 20,
    y: fromTop ? -20 : h * Math.random() * 0.45,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    len: big ? 260 + Math.random() * 160 : 130 + Math.random() * 140,
    width: big ? 2.6 : 1.8,
    age: 0,
    life: big ? 3.2 + Math.random() * 1.4 : 0.9 + Math.random() * 0.7,
    big,
  };
}

export class Starfield {
  private readonly glow = makeGlow();
  private readonly glint = makeGlint();
  private readonly tile = document.createElement('canvas');
  private tileRatio = 0;
  private stars: Star[] = [];
  private twinklers: Star[] = [];
  private comets: Comet[] = [];
  private nextComet = 2 + Math.random() * 3;
  private w = 0;
  private h = 0;
  private lastTime = -1;

  constructor(private readonly density: number) {}

  resize(width: number, height: number): void {
    const th = height + OVERSCAN;
    // A phone's toolbar showing or hiding only changes the height: stretch the
    // same sky to fit rather than re-rolling every star mid-scroll.
    if (width === this.w && this.stars.length && this.h > 0) {
      for (const s of this.stars) s.y *= th / this.h;
    } else {
      this.stars = makeStars(width, th, this.density);
    }
    this.w = width;
    this.h = th;
    this.twinklers = this.stars.filter((s) => s.tw > 0);
    this.tileRatio = 0;
  }

  /** The static tile holds every star that does not twinkle, at this device ratio. */
  private ensureTile(ratio: number): void {
    if (this.tileRatio === ratio) return;
    this.tileRatio = ratio;
    this.tile.width = Math.max(1, Math.round(this.w * ratio));
    this.tile.height = Math.max(1, Math.round(this.h * ratio));
    const t = this.tile.getContext('2d');
    if (!t) return;
    t.setTransform(ratio, 0, 0, ratio, 0, 0);
    for (const s of this.stars) {
      if (s.tw) continue;
      t.fillStyle = `rgba(${TINTS[s.tint]},${s.a})`;
      t.beginPath();
      t.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      t.fill();
    }
  }

  draw(ctx: CanvasRenderingContext2D, v: View, visibility: number): void {
    if (visibility <= 0.01 || this.w === 0) return;
    const ratio = ctx.getTransform().a;
    // The main pass advances time; the downsampled soft pass only re-draws.
    const main = ratio >= 0.5;
    const dt = main && !v.reduced && this.lastTime >= 0 ? Math.min(0.05, Math.max(0, v.time - this.lastTime)) : 0;
    if (main) this.lastTime = v.time;
    if (main) this.ensureTile(Math.min(2, ratio));
    else if (this.tileRatio === 0) this.ensureTile(1);

    const t = v.reduced ? 0 : v.time;
    const top = -OVERSCAN * 0.5 - v.altitude * STAR_K;
    let shift = (t * DRIFT + v.driftX * 0.02) % this.w;
    if (shift < 0) shift += this.w;

    ctx.save();
    ctx.globalAlpha = visibility;
    ctx.drawImage(this.tile, -shift, top, this.w, this.h);
    ctx.drawImage(this.tile, this.w - shift, top, this.w, this.h);

    // The soft (blurred) pass gets only the static field: twinkles and comets
    // would be smeared to nothing there anyway.
    if (!main) {
      ctx.restore();
      return;
    }
    for (const s of this.twinklers) {
      let x = s.x - shift;
      if (x < -20) x += this.w;
      const y = s.y + top;
      if (y < -20 || y > v.height + 20) continue;
      const a = visibility * s.a * (v.reduced ? 1 : 0.55 + 0.45 * Math.sin(t * s.tw + s.ph));
      if (s.r > 1.5) {
        const g = s.r * 7;
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(this.glow, x - g, y - g, g * 2, g * 2);
      }
      if (s.glint) {
        const g = s.r * 9 * (v.reduced ? 1 : 0.7 + 0.3 * Math.sin(t * s.tw * 1.3 + s.ph));
        ctx.globalAlpha = a * 0.8;
        ctx.drawImage(this.glint, x - g, y - g, g * 2, g * 2);
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = `rgb(${TINTS[s.tint]})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shooting stars and comets, once the sky is properly dark.
    if (dt > 0) {
      this.nextComet -= dt;
      if (this.nextComet <= 0) {
        if (visibility > 0.45) this.comets.push(spawnComet(v.width, v.height));
        this.nextComet = 3 + Math.random() * 6;
      }
      for (const c of this.comets) {
        c.age += dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }
      this.comets = this.comets.filter((c) => c.age < c.life);
    }
    if (!v.reduced) for (const c of this.comets) this.drawComet(ctx, c, visibility);
    ctx.restore();
  }

  private drawComet(ctx: CanvasRenderingContext2D, c: Comet, visibility: number): void {
    const p = c.age / c.life;
    const a = Math.min(1, p / 0.12) * Math.min(1, (1 - p) / 0.35) * visibility;
    if (a <= 0) return;
    const sp = Math.hypot(c.vx, c.vy);
    const tx = c.x - (c.vx / sp) * c.len;
    const ty = c.y - (c.vy / sp) * c.len;
    ctx.globalAlpha = a;
    const grad = ctx.createLinearGradient(c.x, c.y, tx, ty);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.25, c.big ? 'rgba(200,225,255,0.45)' : 'rgba(215,232,255,0.5)');
    grad.addColorStop(1, 'rgba(160,200,255,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = c.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    if (c.big) {
      // A wider, fainter coma around the slow comets' tails.
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x - (c.vx / sp) * c.len * 0.45, c.y - (c.vy / sp) * c.len * 0.45);
      ctx.stroke();
    }
    const g = c.big ? 16 : 9;
    ctx.globalAlpha = a;
    ctx.drawImage(this.glow, c.x - g, c.y - g, g * 2, g * 2);
  }
}
