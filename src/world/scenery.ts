import { skyColor, starVisibility } from './atmosphere';

/**
 * Procedural parallax world: sky gradient, launch field, cumulus deck,
 * jet-stream streaks, the earth's limb, and stars. No image assets.
 *
 * Each layer converts altitude to screen offset with its own px-per-metre
 * factor, which is the whole parallax trick.
 */

const GROUND_K = 3.2;
const LOW_CLOUD_K = 0.42;
const MID_CLOUD_K = 0.2;
const JET_K = 0.1;
const STAR_K = 0.0022;

const CLOUD_SPAN = 3600;
const CLOUD_COUNT = 46;
const PUFFS = 6;
const STAR_COUNT = 320;
const STREAK_COUNT = 34;

export function groundScreenY(altitude: number, height: number): number {
  return height - 132 + altitude * GROUND_K;
}

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface View {
  width: number;
  height: number;
  altitude: number;
  time: number;
  driftX: number;
  windStrength: number;
  reduced: boolean;
}

export class Scenery {
  private readonly cloudX = new Float32Array(CLOUD_COUNT);
  private readonly cloudAlt = new Float32Array(CLOUD_COUNT);
  private readonly cloudScale = new Float32Array(CLOUD_COUNT);
  private readonly cloudLow = new Uint8Array(CLOUD_COUNT);
  private readonly puffX = new Float32Array(CLOUD_COUNT * PUFFS);
  private readonly puffY = new Float32Array(CLOUD_COUNT * PUFFS);
  private readonly puffR = new Float32Array(CLOUD_COUNT * PUFFS);

  private readonly starX = new Float32Array(STAR_COUNT);
  private readonly starY = new Float32Array(STAR_COUNT);
  private readonly starR = new Float32Array(STAR_COUNT);
  private readonly starPhase = new Float32Array(STAR_COUNT);

  private readonly streakX = new Float32Array(STREAK_COUNT);
  private readonly streakAlt = new Float32Array(STREAK_COUNT);
  private readonly streakLen = new Float32Array(STREAK_COUNT);
  private readonly streakW = new Float32Array(STREAK_COUNT);

  private readonly hillX = new Float32Array(26);
  private readonly hillH = new Float32Array(26);
  private readonly tuftX = new Float32Array(60);
  private readonly tuftH = new Float32Array(60);

  constructor(density = 1) {
    const r = rand(20260829);
    const clouds = Math.max(18, Math.round(CLOUD_COUNT * density));
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const low = i % 2 === 0;
      this.cloudLow[i] = low ? 1 : 0;
      this.cloudAlt[i] = low ? 1100 + r() * 1800 : 3400 + r() * 6600;
      this.cloudX[i] = r() * CLOUD_SPAN;
      this.cloudScale[i] = (low ? 0.75 : 1.25) * (0.6 + r() * 0.9) * (i < clouds ? 1 : 0);
      for (let p = 0; p < PUFFS; p++) {
        const k = i * PUFFS + p;
        const t = p / (PUFFS - 1);
        this.puffX[k] = (t - 0.5) * 190 + (r() - 0.5) * 40;
        this.puffY[k] = -Math.sin(t * Math.PI) * 26 + (r() - 0.5) * 14;
        this.puffR[k] = 26 + Math.sin(t * Math.PI) * 30 + r() * 14;
      }
    }
    for (let i = 0; i < STAR_COUNT; i++) {
      this.starX[i] = r();
      this.starY[i] = r() * 2.6 - 0.8;
      this.starR[i] = 0.3 + r() * r() * 1.5;
      this.starPhase[i] = r() * 6.283;
    }
    for (let i = 0; i < STREAK_COUNT; i++) {
      this.streakX[i] = r() * CLOUD_SPAN;
      this.streakAlt[i] = 8200 + r() * 8600;
      this.streakLen[i] = 220 + r() * 620;
      this.streakW[i] = 1 + r() * 3.4;
    }
    for (let i = 0; i < this.hillX.length; i++) {
      this.hillX[i] = i / (this.hillX.length - 1);
      this.hillH[i] = 14 + r() * 34;
    }
    for (let i = 0; i < this.tuftX.length; i++) {
      this.tuftX[i] = r();
      this.tuftH[i] = 4 + r() * 9;
    }
  }

  draw(ctx: CanvasRenderingContext2D, v: View): void {
    this.drawSky(ctx, v);
    this.drawStars(ctx, v);
    this.drawSun(ctx, v);
    this.drawLimb(ctx, v);
    this.drawStreaks(ctx, v);
    this.drawClouds(ctx, v, false);
    this.drawGround(ctx, v);
  }

  /** Foreground haze + low cloud drawn after the balloon. */
  drawForeground(ctx: CanvasRenderingContext2D, v: View): void {
    this.drawClouds(ctx, v, true);
  }

  private drawSky(ctx: CanvasRenderingContext2D, v: View): void {
    const g = ctx.createLinearGradient(0, 0, 0, v.height);
    g.addColorStop(0, skyColor(v.altitude, 'top'));
    g.addColorStop(0.58, skyColor(v.altitude, 'mid'));
    g.addColorStop(1, skyColor(v.altitude, 'low'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, v.width, v.height);
  }

  private drawStars(ctx: CanvasRenderingContext2D, v: View): void {
    const a = starVisibility(v.altitude);
    if (a <= 0.01) return;
    const offset = -v.altitude * STAR_K;
    const drift = v.driftX * 0.02;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < STAR_COUNT; i++) {
      let x = (this.starX[i] * v.width - drift) % v.width;
      if (x < 0) x += v.width;
      const y = this.starY[i] * v.height + offset;
      if (y < -20 || y > v.height + 20) continue;
      const tw = v.reduced ? 1 : 0.72 + 0.28 * Math.sin(v.time * 1.7 + this.starPhase[i]);
      ctx.globalAlpha = a * tw * (0.35 + this.starR[i] * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, this.starR[i], 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSun(ctx: CanvasRenderingContext2D, v: View): void {
    const x = v.width * 0.78;
    const y = v.height * 0.2 - v.altitude * 0.0016;
    const dark = Math.min(1, v.altitude / 26000);
    const radius = 320 - dark * 190;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(255,246,224,${0.85 - dark * 0.15})`);
    g.addColorStop(0.18, `rgba(255,226,168,${0.34 - dark * 0.2})`);
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = `rgba(255,252,240,${0.55 + dark * 0.45})`;
    ctx.beginPath();
    ctx.arc(x, y, 14 + (1 - dark) * 8, 0, 6.283);
    ctx.fill();
  }

  private drawLimb(ctx: CanvasRenderingContext2D, v: View): void {
    const a = Math.min(1, Math.max(0, (v.altitude - 4500) / 6500));
    if (a <= 0.01) return;
    const t = Math.min(1, v.altitude / 35000);
    // The limb stays pinned to the bottom edge; it flattens and the curvature
    // tightens as you climb, which is the whole "you can see it bending" cue.
    const bandHeight = 250 - t * 150;
    const top = v.height - bandHeight;
    const curve = 40 + t * 430;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(-40, v.height + 10);
    ctx.lineTo(-40, top + curve);
    ctx.quadraticCurveTo(v.width * 0.5, top - curve * 0.85, v.width + 40, top + curve);
    ctx.lineTo(v.width + 40, v.height + 10);
    ctx.closePath();
    // Hazy land close in, deep ocean-blue once you are high enough that the
    // limb is mostly atmosphere.
    const g = ctx.createLinearGradient(0, top - curve, 0, v.height);
    g.addColorStop(0, `rgba(${104 - t * 40},${138 - t * 76},${150 - t * 40},0.82)`);
    g.addColorStop(0.35, `rgba(${64 - t * 24},${96 - t * 46},${124 - t * 32},0.88)`);
    g.addColorStop(1, 'rgba(18,32,54,0.94)');
    ctx.fillStyle = g;
    ctx.fill();

    // Thin airglow along the limb.
    ctx.lineWidth = 2.5 + t * 3;
    ctx.strokeStyle = `rgba(150,205,240,${0.35 + t * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(-40, top + curve);
    ctx.quadraticCurveTo(v.width * 0.5, top - curve * 0.85, v.width + 40, top + curve);
    ctx.stroke();
    ctx.restore();
  }

  private drawStreaks(ctx: CanvasRenderingContext2D, v: View): void {
    const strength = v.windStrength;
    if (strength < 0.06) return;
    ctx.save();
    for (let i = 0; i < STREAK_COUNT; i++) {
      const sy = v.height * 0.5 - (this.streakAlt[i] - v.altitude) * JET_K;
      if (sy < -30 || sy > v.height + 30) continue;
      let x = (this.streakX[i] + v.driftX * 0.55) % (CLOUD_SPAN + v.width);
      if (x < 0) x += CLOUD_SPAN + v.width;
      x -= 200;
      const len = this.streakLen[i] * (0.6 + strength);
      ctx.globalAlpha = Math.min(0.62, strength * 0.8);
      ctx.strokeStyle = 'rgba(236,244,252,0.85)';
      ctx.lineWidth = this.streakW[i];
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.quadraticCurveTo(x + len * 0.5, sy - 6, x + len, sy + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, v: View, foreground: boolean): void {
    ctx.save();
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const scale = this.cloudScale[i];
      if (scale <= 0) continue;
      const low = this.cloudLow[i] === 1;
      if (low !== foreground) continue;
      const k = low ? LOW_CLOUD_K : MID_CLOUD_K;
      const sy = v.height * 0.5 - (this.cloudAlt[i] - v.altitude) * k;
      if (sy < -220 || sy > v.height + 220) continue;

      const span = CLOUD_SPAN + v.width;
      let x = (this.cloudX[i] + v.driftX * (low ? 1 : 0.45)) % span;
      if (x < 0) x += span;
      x -= 260;

      const fade = 1 - Math.min(1, Math.abs(this.cloudAlt[i] - v.altitude) / (low ? 2600 : 7000));
      const alpha = (low ? 0.88 : 0.28) * (0.2 + fade * 0.85);
      const shade = Math.max(0, 1 - v.altitude / 20000);
      // Cumulus below, stretched cirrus above — same puffs, different aspect.
      const stretch = low ? 1 : 2.4;
      const squash = low ? 0.92 : 0.2;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(${232 - (1 - shade) * 90},${238 - (1 - shade) * 90},${246 - (1 - shade) * 80},1)`;
      ctx.beginPath();
      for (let p = 0; p < PUFFS; p++) {
        const q = i * PUFFS + p;
        const cxp = x + this.puffX[q] * scale * stretch;
        const cyp = sy + this.puffY[q] * scale * squash;
        const rx = this.puffR[q] * scale * stretch;
        const ry = this.puffR[q] * scale * squash;
        ctx.moveTo(cxp + rx, cyp);
        ctx.ellipse(cxp, cyp, rx, ry, 0, 0, 6.283);
      }
      ctx.fill();

      if (!low) continue;
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = 'rgba(148,162,184,1)';
      ctx.beginPath();
      for (let p = 0; p < PUFFS; p++) {
        const q = i * PUFFS + p;
        const rr = this.puffR[q] * scale * 0.7;
        ctx.moveTo(x + this.puffX[q] * scale + rr, sy + (this.puffY[q] + 14) * scale);
        ctx.arc(x + this.puffX[q] * scale, sy + (this.puffY[q] + 14) * scale, rr, 0, 6.283);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D, v: View): void {
    const gy = groundScreenY(v.altitude, v.height);
    if (gy > v.height + 260) return;
    const fade = Math.min(1, Math.max(0, 1 - (v.altitude - 200) / 900));
    ctx.save();
    ctx.globalAlpha = 0.35 + fade * 0.65;

    // Distant hill line.
    ctx.fillStyle = 'rgba(122,142,132,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let i = 0; i < this.hillX.length; i++) {
      const x = this.hillX[i] * v.width;
      ctx.lineTo(x, gy - this.hillH[i]);
    }
    ctx.lineTo(v.width, gy);
    ctx.closePath();
    ctx.fill();

    // Field.
    const g = ctx.createLinearGradient(0, gy - 10, 0, gy + 300);
    g.addColorStop(0, '#8b9b74');
    g.addColorStop(0.25, '#75855f');
    g.addColorStop(1, '#4c5a41');
    ctx.fillStyle = g;
    ctx.fillRect(-2, gy, v.width + 4, 320);

    // Grass tufts.
    ctx.strokeStyle = 'rgba(58,72,48,0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i < this.tuftX.length; i++) {
      const x = this.tuftX[i] * v.width;
      const h = this.tuftH[i];
      ctx.moveTo(x, gy + 6 + (i % 5) * 7);
      ctx.lineTo(x + (i % 2 ? 3 : -3), gy + 6 + (i % 5) * 7 - h);
    }
    ctx.stroke();

    this.drawPad(ctx, v, gy);
    ctx.restore();
  }

  private drawPad(ctx: CanvasRenderingContext2D, v: View, gy: number): void {
    const cx = v.width * 0.5;

    // Concrete slab.
    ctx.fillStyle = '#c9c3b4';
    ctx.fillRect(cx - 96, gy - 6, 192, 12);
    ctx.fillStyle = '#a8a294';
    ctx.fillRect(cx - 96, gy + 6, 192, 5);
    ctx.strokeStyle = 'rgba(40,44,40,0.4)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 38, gy - 6);
      ctx.lineTo(cx + i * 38, gy + 6);
      ctx.stroke();
    }

    // Hazard chevrons on the slab edge.
    ctx.fillStyle = 'rgba(226,102,44,0.85)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 96 + i * 24, gy + 6);
      ctx.lineTo(cx - 84 + i * 24, gy + 6);
      ctx.lineTo(cx - 90 + i * 24, gy + 11);
      ctx.closePath();
      ctx.fill();
    }

    // Tether reel.
    ctx.fillStyle = '#4a4f56';
    ctx.fillRect(cx + 58, gy - 24, 26, 18);
    ctx.strokeStyle = '#2c3036';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 71, gy - 15, 7, 0, 6.283);
    ctx.stroke();

    // Ground station case + whip antenna.
    ctx.fillStyle = '#3d434a';
    ctx.fillRect(cx - 104, gy - 20, 30, 14);
    ctx.strokeStyle = '#2c3036';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 89, gy - 20);
    ctx.lineTo(cx - 92, gy - 52);
    ctx.stroke();

    // Windsock — reads the live wind.
    const mastX = cx + 128;
    ctx.strokeStyle = '#8a8f96';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(mastX, gy);
    ctx.lineTo(mastX, gy - 62);
    ctx.stroke();
    const lift = Math.min(1, v.windStrength * 4 + 0.12);
    const sockLen = 34;
    const tipY = gy - 62 + (1 - lift) * 26;
    ctx.fillStyle = 'rgba(226,102,44,0.92)';
    ctx.beginPath();
    ctx.moveTo(mastX, gy - 68);
    ctx.lineTo(mastX + sockLen * lift + 6, tipY - 4);
    ctx.lineTo(mastX + sockLen * lift + 6, tipY + 6);
    ctx.lineTo(mastX, gy - 54);
    ctx.closePath();
    ctx.fill();
  }
}
