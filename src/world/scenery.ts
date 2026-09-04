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
const STAR_K = 0.0022;

const CLOUD_SPAN = 3600;
const CLOUD_COUNT = 46;
const PUFFS = 6;
const STAR_COUNT = 320;
const BLEED = 24;
const HAZE_K = 0.02;

function makeBrush(size: number, innerStop: number, color: string, edge: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D cloud brush context is unavailable.');
  const half = size * 0.5;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, color);
  gradient.addColorStop(innerStop, color);
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

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
  private readonly brushSoft = makeBrush(64, 0.18, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  private readonly brushNear = makeBrush(128, 0.42, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  private readonly brushShade = makeBrush(64, 0.2, 'rgba(196,206,222,1)', 'rgba(196,206,222,0)');
  private readonly layerDivisor: number;
  private cloudLayer: HTMLCanvasElement | undefined;
  private cloudLayerContext: CanvasRenderingContext2D | undefined;
  private cirrusLayer: HTMLCanvasElement | undefined;
  private cirrusLayerContext: CanvasRenderingContext2D | undefined;
  private lastCloudAltitude = Number.POSITIVE_INFINITY;
  private lastCloudDrift = Number.POSITIVE_INFINITY;
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

  private readonly hillX = new Float32Array(26);
  private readonly hillH = new Float32Array(26);
  private readonly tuftX = new Float32Array(60);
  private readonly tuftH = new Float32Array(60);

  constructor(density = 1) {
    this.layerDivisor = density < 1 ? 6 : 4;
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
    for (let i = 0; i < this.hillX.length; i++) {
      this.hillX[i] = i / (this.hillX.length - 1);
      this.hillH[i] = 14 + r() * 34;
    }
    for (let i = 0; i < this.tuftX.length; i++) {
      this.tuftX[i] = r();
      this.tuftH[i] = 4 + r() * 9;
    }
  }

  resize(width: number, height: number): void {
    const divisor = this.layerDivisor;
    const cloudLayer = document.createElement('canvas');
    cloudLayer.width = Math.ceil(width / divisor);
    cloudLayer.height = Math.ceil(height / divisor);
    const cloudLayerContext = cloudLayer.getContext('2d');
    if (!cloudLayerContext) throw new Error('2D cloud layer context is unavailable.');
    cloudLayerContext.imageSmoothingEnabled = true;
    this.cloudLayer = cloudLayer;
    this.cloudLayerContext = cloudLayerContext;

    const cirrusLayer = document.createElement('canvas');
    cirrusLayer.width = Math.ceil((width * 2) / divisor);
    cirrusLayer.height = Math.ceil(height / divisor);
    const cirrusLayerContext = cirrusLayer.getContext('2d');
    if (!cirrusLayerContext) throw new Error('2D cirrus layer context is unavailable.');
    cirrusLayerContext.imageSmoothingEnabled = true;
    this.cirrusLayer = cirrusLayer;
    this.cirrusLayerContext = cirrusLayerContext;
    this.renderCirrus(width, height);
    this.lastCloudAltitude = Number.POSITIVE_INFINITY;
    this.lastCloudDrift = Number.POSITIVE_INFINITY;
  }

  draw(ctx: CanvasRenderingContext2D, v: View): void {
    this.drawSky(ctx, v);
    this.drawHaze(ctx, v);
    this.drawStars(ctx, v);
    this.drawSun(ctx, v);
    this.drawLimb(ctx, v);
    this.drawCirrus(ctx, v);
    this.drawCloudLayer(ctx, v);
    this.drawGround(ctx, v);
  }

  /** Foreground haze + low cloud drawn after the balloon. */
  drawForeground(ctx: CanvasRenderingContext2D, v: View): void {
    this.drawForegroundClouds(ctx, v);
  }

  private drawSky(ctx: CanvasRenderingContext2D, v: View): void {
    const horizonY = v.height * 0.72 + v.altitude * HAZE_K;
    const horizon = horizonY / v.height;
    const upper = Math.min(0.34, horizon * 0.42);
    const mid = Math.min(0.68, horizon * 0.72);
    const haze = Math.min(0.98, Math.max(mid + 0.02, horizon));
    const g = ctx.createLinearGradient(0, 0, 0, v.height);
    g.addColorStop(0, skyColor(v.altitude, 'top'));
    g.addColorStop(upper, skyColor(v.altitude, 'upper'));
    g.addColorStop(mid, skyColor(v.altitude, 'mid'));
    g.addColorStop(haze, skyColor(v.altitude, 'haze'));
    g.addColorStop(1, skyColor(v.altitude, 'low'));
    ctx.fillStyle = g;
    ctx.fillRect(-BLEED, -BLEED, v.width + 2 * BLEED, v.height + 2 * BLEED);
  }

  private drawHaze(ctx: CanvasRenderingContext2D, v: View): void {
    const alpha = 0.35 * Math.max(0, 1 - v.altitude / 10000);
    if (alpha <= 0) return;
    const horizonY = v.height * 0.72 + v.altitude * HAZE_K;
    const halfBand = v.height * 0.12;
    const g = ctx.createLinearGradient(0, horizonY - halfBand, 0, horizonY + halfBand);
    g.addColorStop(0, 'rgba(255,247,229,0)');
    g.addColorStop(0.5, `rgba(255,247,229,${alpha})`);
    g.addColorStop(1, 'rgba(255,247,229,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-BLEED, horizonY - halfBand, v.width + 2 * BLEED, halfBand * 2);
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
      if (y < -BLEED || y > v.height + BLEED) continue;
      const tw = v.reduced ? 1 : 0.72 + 0.28 * Math.sin(v.time * 1.7 + this.starPhase[i]);
      ctx.globalAlpha = a * tw * (0.35 + this.starR[i] * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, this.starR[i], 0, 6.283);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawSun(ctx: CanvasRenderingContext2D, v: View): void {
    const x = v.width * 0.22;
    const y = v.height * 0.2 - v.altitude * 0.0016;
    const dark = Math.min(1, v.altitude / 26000);
    const radius = 320 - dark * 190;
    const haloRadius = v.height * 0.9;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    halo.addColorStop(0, `rgba(255,224,171,${0.1 * (1 - dark * 0.55)})`);
    halo.addColorStop(1, 'rgba(255,224,171,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2);
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
    ctx.moveTo(-40, v.height + BLEED);
    ctx.lineTo(-40, top + curve);
    ctx.quadraticCurveTo(v.width * 0.5, top - curve * 0.85, v.width + 40, top + curve);
    ctx.lineTo(v.width + 40, v.height + BLEED);
    ctx.closePath();
    // A solid deep-ocean body keeps gradient creation inside the four-pass
    // atmosphere budget; the bright stroked airglow supplies the limb depth.
    ctx.fillStyle = `rgba(${36 - t * 18},${68 - t * 36},${91 - t * 37},0.92)`;
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

  private drawCloudLayer(ctx: CanvasRenderingContext2D, v: View): void {
    if (v.altitude >= 14000) return;
    const layer = this.cloudLayer;
    const layerCtx = this.cloudLayerContext;
    if (!layer || !layerCtx) return;
    if (Math.abs(v.altitude - this.lastCloudAltitude) > 2 || Math.abs(v.driftX - this.lastCloudDrift) > 0.5) {
      this.renderCloudLayer(v);
      this.lastCloudAltitude = v.altitude;
      this.lastCloudDrift = v.driftX;
    }
    const fade = Math.min(1, Math.max(0, (14000 - v.altitude) / 2500));
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, v.width, v.height);
    ctx.restore();
  }

  private renderCloudLayer(v: View): void {
    const ctx = this.cloudLayerContext;
    if (!ctx) return;
    const divisor = this.layerDivisor;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const scale = this.cloudScale[i];
      if (scale <= 0) continue;
      const low = this.cloudLow[i] === 1;
      if (low) continue;
      const sy = v.height * 0.5 - (this.cloudAlt[i] - v.altitude) * MID_CLOUD_K;
      if (sy < -220 || sy > v.height + 220) continue;
      const span = CLOUD_SPAN + v.width;
      let x = (this.cloudX[i] + v.driftX * 0.45) % span;
      if (x < 0) x += span;
      x -= 260;
      const proximity = 1 - Math.min(1, Math.abs(this.cloudAlt[i] - v.altitude) / 7000);
      const alpha = 0.3 * (0.2 + proximity * 0.8);
      ctx.globalAlpha = alpha * 0.72;
      for (let p = 0; p < 4; p++) {
        const q = i * PUFFS + p;
        const radius = this.puffR[q] * scale;
        const cx = (x + this.puffX[q] * scale) / divisor;
        const cy = (sy + 18 * scale) / divisor;
        ctx.drawImage(this.brushShade, cx - radius / divisor, cy - radius * 0.45 / divisor, radius * 2 / divisor, radius * 0.9 / divisor);
      }
      ctx.globalAlpha = alpha;
      for (let p = 0; p < 5; p++) {
        const q = i * PUFFS + p;
        const radius = this.puffR[q] * scale;
        const cx = (x + this.puffX[q] * scale) / divisor;
        const cy = (sy + this.puffY[q] * scale - radius * 0.3) / divisor;
        ctx.drawImage(this.brushSoft, cx - radius / divisor, cy - radius / divisor, radius * 2 / divisor, radius * 2 / divisor);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawForegroundClouds(ctx: CanvasRenderingContext2D, v: View): void {
    ctx.save();
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const scale = this.cloudScale[i];
      if (scale <= 0 || this.cloudLow[i] !== 1) continue;
      const sy = v.height * 0.5 - (this.cloudAlt[i] - v.altitude) * LOW_CLOUD_K;
      if (sy < -220 || sy > v.height + 220) continue;
      const span = CLOUD_SPAN + v.width;
      let x = (this.cloudX[i] + v.driftX) % span;
      if (x < 0) x += span;
      x -= 260;
      const proximity = 1 - Math.min(1, Math.abs(this.cloudAlt[i] - v.altitude) / 2600);
      const alpha = 0.88 * (0.2 + proximity * 0.85);
      ctx.globalAlpha = alpha * 0.32;
      for (let p = 0; p < 4; p++) {
        const q = i * PUFFS + p;
        const radius = this.puffR[q] * scale;
        const cx = x + this.puffX[q] * scale;
        const cy = sy + 18 * scale;
        ctx.drawImage(this.brushShade, cx - radius, cy - radius * 0.45, radius * 2, radius * 0.9);
      }
      ctx.globalAlpha = alpha;
      for (let p = 0; p < 5; p++) {
        const q = i * PUFFS + p;
        const radius = this.puffR[q] * scale;
        const cx = x + this.puffX[q] * scale;
        const cy = sy + this.puffY[q] * scale - radius * 0.3;
        ctx.drawImage(this.brushNear, cx - radius, cy - radius, radius * 2, radius * 2);
      }
    }
    ctx.restore();
  }

  private renderCirrus(width: number, height: number): void {
    const ctx = this.cirrusLayerContext;
    if (!ctx) return;
    const divisor = this.layerDivisor;
    const r = rand(20260904);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let i = 0; i < 30; i++) {
      const x = r() * width * 2 / divisor;
      const y = (height * (0.57 + r() * 0.32)) / divisor;
      const w = (180 + r() * 620) / divisor;
      const h = (5 + r() * 13) / divisor;
      ctx.globalAlpha = 0.05 + r() * 0.13;
      ctx.drawImage(this.brushSoft, x - w * 0.5, y - h * 0.5, w, h);
    }
    ctx.globalAlpha = 1;
  }

  private drawCirrus(ctx: CanvasRenderingContext2D, v: View): void {
    if (v.altitude <= 3000 || v.altitude >= 14000) return;
    const layer = this.cirrusLayer;
    if (!layer) return;
    const rise = v.altitude < 9000 ? (v.altitude - 3000) / 6000 : (14000 - v.altitude) / 5000;
    const layerWidth = v.width * 2;
    let offset = (v.driftX * 0.3) % layerWidth;
    if (offset < 0) offset += layerWidth;
    const y = (v.altitude - 9000) * 0.008;
    ctx.save();
    ctx.globalAlpha = Math.max(0, rise);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer, -offset, y, layerWidth, v.height);
    ctx.drawImage(layer, layerWidth - offset, y, layerWidth, v.height);
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

    // Field. A pair of solid bands avoids a fifth per-frame gradient.
    ctx.fillStyle = '#75855f';
    ctx.fillRect(-BLEED, gy, v.width + 2 * BLEED, 320 + BLEED);
    ctx.fillStyle = 'rgba(76,90,65,0.55)';
    ctx.fillRect(-BLEED, gy + 72, v.width + 2 * BLEED, 248 + BLEED);

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
