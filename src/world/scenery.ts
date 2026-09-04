import { skyColor, starVisibility } from './atmosphere';
import { fbm1, noise1 } from '../physics/wind';

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
const GROUND_PAD = 120;
const RIDGE_HEIGHT = 200;
const GROUND_HEIGHT = 440;
const RIDGE_BASELINE = 190;
const GROUND_BASELINE = 90;

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

function makeBushBrush(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 18;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D bush brush context is unavailable.');
  ctx.fillStyle = '#4d5838';
  ctx.beginPath();
  ctx.arc(5, 12, 4, 0, 6.283);
  ctx.arc(9, 8, 5, 0, 6.283);
  ctx.arc(14, 10, 6, 0, 6.283);
  ctx.arc(19, 12, 4, 0, 6.283);
  ctx.arc(11, 13, 5, 0, 6.283);
  ctx.fill();
  ctx.strokeStyle = '#7c8558';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(8.5, 8, 4.2, 3.35, 5.25);
  ctx.arc(13.5, 10, 5.2, 3.4, 4.95);
  ctx.arc(4.8, 12, 3.2, 3.5, 5.1);
  ctx.stroke();
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
  private readonly brushCrown = makeBrush(64, 0.24, 'rgba(255,249,234,1)', 'rgba(255,249,234,0)');
  private readonly brushBush = makeBushBrush();
  private readonly layerDivisor: number;
  private cloudLayer: HTMLCanvasElement | undefined;
  private cloudLayerContext: CanvasRenderingContext2D | undefined;
  private cirrusLayer: HTMLCanvasElement | undefined;
  private cirrusLayerContext: CanvasRenderingContext2D | undefined;
  private ridgeLayer: HTMLCanvasElement | undefined;
  private groundLayer: HTMLCanvasElement | undefined;
  private lastCloudAltitude = Number.POSITIVE_INFINITY;
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

  private readonly duneX = new Float32Array(6);
  private readonly duneW = new Float32Array(6);
  private readonly duneH = new Float32Array(6);
  private readonly bushX = new Float32Array(40);
  private readonly bushY = new Float32Array(40);
  private readonly bushS = new Float32Array(40);

  constructor(density = 1) {
    this.layerDivisor = density < 1 ? 5 : 3;
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
    for (let i = 0; i < this.duneX.length; i++) {
      this.duneX[i] = r();
      this.duneW[i] = r();
      this.duneH[i] = r();
    }
    for (let i = 0; i < this.bushX.length; i++) {
      this.bushX[i] = r();
      this.bushY[i] = r();
      this.bushS[i] = r();
    }
  }

  resize(width: number, height: number): void {
    const divisor = this.layerDivisor;
    const cloudLayer = document.createElement('canvas');
    cloudLayer.width = Math.ceil((CLOUD_SPAN + width) / divisor);
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

    const ridgeLayer = document.createElement('canvas');
    ridgeLayer.width = Math.ceil(width + 2 * GROUND_PAD);
    ridgeLayer.height = RIDGE_HEIGHT;
    this.ridgeLayer = ridgeLayer;

    const groundLayer = document.createElement('canvas');
    groundLayer.width = Math.ceil(width + 2 * GROUND_PAD);
    groundLayer.height = GROUND_HEIGHT;
    this.groundLayer = groundLayer;

    this.renderGround();
    this.renderCirrus(width, height);
    this.lastCloudAltitude = Number.POSITIVE_INFINITY;
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
    const dusk = Math.min(1, Math.max(0, 1 - v.altitude / 2000));
    const horizonY = v.height * 0.72 + v.altitude * HAZE_K;
    const horizon = horizonY / v.height;
    const upper = Math.min(0.34, horizon * 0.42);
    const mid = Math.min(0.68, horizon * 0.72);
    const haze = Math.min(0.98, Math.max(mid + 0.02, horizon));
    const g = ctx.createLinearGradient(0, 0, 0, v.height);
    g.addColorStop(0, skyColor(v.altitude, 'top'));
    g.addColorStop(upper, skyColor(v.altitude, 'upper'));
    g.addColorStop(mid, skyColor(v.altitude, 'mid', 1, dusk));
    g.addColorStop(haze, skyColor(v.altitude, 'haze', 1, dusk));
    g.addColorStop(1, skyColor(v.altitude, 'low', 1, dusk));
    ctx.fillStyle = g;
    ctx.fillRect(-BLEED, -BLEED, v.width + 2 * BLEED, v.height + 2 * BLEED);
  }

  private drawHaze(ctx: CanvasRenderingContext2D, v: View): void {
    const dusk = Math.min(1, Math.max(0, 1 - v.altitude / 2000));
    const alpha = 0.28 * Math.max(0, 1 - v.altitude / 10000) + 0.12 * dusk;
    if (alpha <= 0) return;
    const hazeGreen = Math.round(247 + (205 - 247) * dusk);
    const hazeBlue = Math.round(229 + (160 - 229) * dusk);
    const horizonY = v.height * 0.72 + v.altitude * HAZE_K;
    const halfBand = v.height * 0.07;
    const g = ctx.createLinearGradient(0, horizonY - halfBand, 0, horizonY + halfBand);
    g.addColorStop(0, `rgba(255,${hazeGreen},${hazeBlue},0)`);
    g.addColorStop(0.5, `rgba(255,${hazeGreen},${hazeBlue},${alpha})`);
    g.addColorStop(1, `rgba(255,${hazeGreen},${hazeBlue},0)`);
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
    const dusk = Math.min(1, Math.max(0, 1 - v.altitude / 2000));
    const x = v.width * 0.22;
    const y = v.height * 0.2 - v.altitude * 0.0016 + dusk * v.height * 0.18;
    const dark = Math.min(1, v.altitude / 26000);
    const radius = 320 - dark * 190;
    const haloRadius = v.height * 0.9;
    const haloGreen = Math.round(224 + (190 - 224) * dusk);
    const haloBlue = Math.round(171 + (120 - 171) * dusk);
    const glowGreen = Math.round(246 + (190 - 246) * dusk);
    const glowBlue = Math.round(224 + (120 - 224) * dusk);
    const innerGreen = Math.round(226 + (190 - 226) * dusk);
    const innerBlue = Math.round(168 + (120 - 168) * dusk);
    const edgeGreen = Math.round(214 + (190 - 214) * dusk);
    const edgeBlue = Math.round(150 + (120 - 150) * dusk);
    const discGreen = Math.round(252 + (190 - 252) * dusk);
    const discBlue = Math.round(240 + (120 - 240) * dusk);
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    halo.addColorStop(0, `rgba(255,${haloGreen},${haloBlue},${0.1 * (1 - dark * 0.55)})`);
    halo.addColorStop(1, `rgba(255,${haloGreen},${haloBlue},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(x - haloRadius, y - haloRadius, haloRadius * 2, haloRadius * 2);
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(255,${glowGreen},${glowBlue},${0.85 - dark * 0.15})`);
    g.addColorStop(0.18, `rgba(255,${innerGreen},${innerBlue},${0.34 - dark * 0.2})`);
    g.addColorStop(1, `rgba(255,${edgeGreen},${edgeBlue},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.fillStyle = `rgba(255,${discGreen},${discBlue},${0.55 + dark * 0.45})`;
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
    if (Math.abs(v.altitude - this.lastCloudAltitude) > 2) {
      this.renderCloudLayer(v);
      this.lastCloudAltitude = v.altitude;
    }
    const fade = Math.min(1, Math.max(0, (14000 - v.altitude) / 2500));
    const span = CLOUD_SPAN + v.width;
    let offset = (-v.driftX * 0.45) % span;
    if (offset < 0) offset += span;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer, -offset, 0, span, v.height);
    ctx.drawImage(layer, span - offset, 0, span, v.height);
    ctx.restore();
  }

  private renderCloudLayer(v: View): void {
    const ctx = this.cloudLayerContext;
    if (!ctx) return;
    const divisor = this.layerDivisor;
    const span = CLOUD_SPAN + v.width;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const scale = this.cloudScale[i];
      if (scale <= 0) continue;
      const low = this.cloudLow[i] === 1;
      if (low) continue;
      const eyeLevelY = v.height * 0.5 - (this.cloudAlt[i] - v.altitude) * MID_CLOUD_K;
      const overhead = Math.min(1, Math.max(0, (v.altitude - 4500) / 1500));
      const deckY = v.height * (0.56 + ((this.cloudAlt[i] - 3400) / 6600) * 0.34)
        + Math.max(0, v.altitude - 6000) * 0.018;
      const sy = eyeLevelY + (deckY - eyeLevelY) * overhead;
      if (sy < -220 || sy > v.height + 220) continue;
      let x = this.cloudX[i] % span;
      if (x < 0) x += span;
      x -= 260;
      if (x < 0) x += span;
      const proximity = 1 - Math.min(1, Math.abs(this.cloudAlt[i] - v.altitude) / 7000);
      const alpha = 0.3 * (0.2 + proximity * 0.8);
      const high = Math.min(1, Math.max(0, (v.altitude - 6000) / 6000));
      const perspective = v.altitude < 6000 ? 0.62 : 0.28 - high * 0.14;
      const flatten = 1 - high * 0.52;
      const drawCloud = (stampX: number): void => {
        ctx.globalAlpha = alpha * 0.82;
        for (let p = 0; p < 4; p++) {
          const q = i * PUFFS + p;
          const radius = this.puffR[q] * scale * perspective;
          const cx = (stampX + this.puffX[q] * scale * perspective) / divisor;
          const cy = (sy + 16 * scale * perspective) / divisor;
          ctx.drawImage(this.brushShade, cx - radius / divisor, cy - radius * 0.625 / divisor, radius * 2 / divisor, radius * 1.25 / divisor);
        }
        ctx.globalAlpha = alpha * 0.92;
        for (let p = 0; p < 5; p++) {
          const q = i * PUFFS + p;
          const radius = this.puffR[q] * scale * perspective;
          const cx = (stampX + this.puffX[q] * scale * perspective - radius * 0.18) / divisor;
          const cy = (sy + this.puffY[q] * scale * perspective - radius * 0.46) / divisor;
          ctx.drawImage(this.brushSoft, cx - radius / divisor, cy - radius * flatten / divisor, radius * 2 / divisor, radius * 2 * flatten / divisor);
        }
        const crown = i * PUFFS + 2;
        const crownRadius = this.puffR[crown] * scale * perspective * 0.62;
        const crownX = (stampX + this.puffX[crown] * scale * perspective - crownRadius * 0.35) / divisor;
        const crownY = (sy + this.puffY[crown] * scale * perspective - crownRadius * 1.15) / divisor;
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.brushCrown, crownX - crownRadius / divisor, crownY - crownRadius * flatten / divisor, crownRadius * 2 / divisor, crownRadius * 2 * flatten / divisor);
      };
      drawCloud(x);
      if (x > span - 520) drawCloud(x - span);
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
      ctx.globalAlpha = alpha * 0.68;
      for (let p = 0; p < 4; p++) {
        const q = i * PUFFS + p;
        const radius = this.puffR[q] * scale;
        const cx = x + this.puffX[q] * scale;
        const cy = sy + 20 * scale;
        ctx.drawImage(this.brushShade, cx - radius, cy - radius * 0.625, radius * 2, radius * 1.25);
      }
      ctx.globalAlpha = alpha * 0.94;
      for (let p = 0; p < 5; p++) {
        const q = i * PUFFS + p;
        const radius = this.puffR[q] * scale;
        const cx = x + this.puffX[q] * scale - radius * 0.2;
        const cy = sy + this.puffY[q] * scale - radius * 0.48;
        ctx.drawImage(this.brushNear, cx - radius, cy - radius, radius * 2, radius * 2);
      }
      const crown = i * PUFFS + 2;
      const crownRadius = this.puffR[crown] * scale * 0.64;
      const crownX = x + this.puffX[crown] * scale - crownRadius * 0.38;
      const crownY = sy + this.puffY[crown] * scale - crownRadius * 1.2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.brushCrown, crownX - crownRadius, crownY - crownRadius, crownRadius * 2, crownRadius * 2);
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
      ctx.globalAlpha = 0.09 + r() * 0.16;
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

  private renderGround(): void {
    const ridgeLayer = this.ridgeLayer;
    const groundLayer = this.groundLayer;
    if (!ridgeLayer || !groundLayer) return;
    const ridgeCtx = ridgeLayer.getContext('2d');
    const groundCtx = groundLayer.getContext('2d');
    if (!ridgeCtx || !groundCtx) throw new Error('2D terrain layer context is unavailable.');

    const ridgeWidth = ridgeLayer.width;
    ridgeCtx.clearRect(0, 0, ridgeWidth, RIDGE_HEIGHT);

    ridgeCtx.fillStyle = 'rgba(92,72,104,0.85)';
    ridgeCtx.beginPath();
    ridgeCtx.moveTo(0, RIDGE_HEIGHT);
    for (let x = 0; x <= ridgeWidth; x += 4) {
      ridgeCtx.lineTo(x, RIDGE_BASELINE - (70 + 48 * fbm1(x * 0.004 + 3.1)));
    }
    ridgeCtx.lineTo(ridgeWidth, RIDGE_HEIGHT);
    ridgeCtx.closePath();
    ridgeCtx.fill();

    ridgeCtx.strokeStyle = 'rgba(205,167,170,0.22)';
    ridgeCtx.lineWidth = 4;
    ridgeCtx.beginPath();
    for (let x = 0; x <= ridgeWidth; x += 4) {
      const y = RIDGE_BASELINE - (70 + 48 * fbm1(x * 0.004 + 3.1));
      if (x === 0) ridgeCtx.moveTo(x, y);
      else ridgeCtx.lineTo(x, y);
    }
    ridgeCtx.stroke();

    ridgeCtx.fillStyle = '#6e4f58';
    ridgeCtx.beginPath();
    ridgeCtx.moveTo(0, RIDGE_HEIGHT);
    for (let x = 0; x <= ridgeWidth; x += 3) {
      ridgeCtx.lineTo(x, RIDGE_BASELINE - (38 + 30 * fbm1(x * 0.009 + 9.7)));
    }
    ridgeCtx.lineTo(ridgeWidth, RIDGE_HEIGHT);
    ridgeCtx.closePath();
    ridgeCtx.fill();

    const groundWidth = groundLayer.width;
    groundCtx.clearRect(0, 0, groundWidth, GROUND_HEIGHT);
    groundCtx.fillStyle = '#8e6a58';
    groundCtx.beginPath();
    groundCtx.moveTo(0, GROUND_HEIGHT);
    for (let x = 0; x <= groundWidth; x += 3) {
      groundCtx.lineTo(x, GROUND_BASELINE - (14 + 12 * noise1(x * 0.02)));
    }
    groundCtx.lineTo(groundWidth, GROUND_HEIGHT);
    groundCtx.closePath();
    groundCtx.fill();

    groundCtx.fillStyle = '#d9a86c';
    groundCtx.fillRect(0, GROUND_BASELINE, groundWidth, GROUND_HEIGHT - GROUND_BASELINE);
    groundCtx.fillStyle = 'rgba(160,110,70,0.55)';
    groundCtx.fillRect(0, GROUND_BASELINE + 72, groundWidth, GROUND_HEIGHT - GROUND_BASELINE - 72);

    for (let i = 0; i < this.duneX.length; i++) {
      const x = this.duneX[i] * groundWidth;
      const width = 150 + this.duneW[i] * 230;
      const height = 24 + this.duneH[i] * 48;
      const y = GROUND_BASELINE + 22 + (i % 3) * 29;

      groundCtx.fillStyle = 'rgba(90,50,40,0.35)';
      groundCtx.beginPath();
      groundCtx.moveTo(x - width * 0.08, y - height * 0.72);
      groundCtx.lineTo(x + width * 0.98, y + height * 0.22);
      groundCtx.lineTo(x + width * 0.78, y + height * 0.48);
      groundCtx.lineTo(x - width * 0.12, y + height * 0.12);
      groundCtx.closePath();
      groundCtx.fill();

      groundCtx.fillStyle = '#e9c08a';
      groundCtx.beginPath();
      groundCtx.moveTo(x - width * 0.5, y + 8);
      groundCtx.quadraticCurveTo(x - width * 0.32, y - height * 0.5, x - width * 0.05, y - height);
      groundCtx.quadraticCurveTo(x + width * 0.02, y - height * 0.88, x + width * 0.11, y - height * 0.68);
      groundCtx.lineTo(x + width * 0.12, y + 14);
      groundCtx.quadraticCurveTo(x - width * 0.2, y + 2, x - width * 0.5, y + 8);
      groundCtx.closePath();
      groundCtx.fill();

      groundCtx.fillStyle = '#a86f48';
      groundCtx.beginPath();
      groundCtx.moveTo(x - width * 0.05, y - height);
      groundCtx.quadraticCurveTo(x + width * 0.18, y - height * 0.7, x + width * 0.5, y + 8);
      groundCtx.quadraticCurveTo(x + width * 0.3, y + 1, x + width * 0.12, y + 14);
      groundCtx.lineTo(x + width * 0.11, y - height * 0.68);
      groundCtx.quadraticCurveTo(x + width * 0.02, y - height * 0.88, x - width * 0.05, y - height);
      groundCtx.closePath();
      groundCtx.fill();
    }

    groundCtx.fillStyle = 'rgba(70,40,30,0.30)';
    for (let i = 0; i < this.bushX.length; i++) {
      const yFraction = this.bushY[i];
      const x = this.bushX[i] * groundWidth;
      const y = GROUND_BASELINE + 4 + yFraction * 146;
      const scale = 0.7 + 0.9 * (yFraction * 0.7 + this.bushS[i] * 0.3);
      groundCtx.beginPath();
      groundCtx.ellipse(x + 30 * scale, y + 5 * scale, 36 * scale, 4 * scale, 0.12, 0, 6.283);
      groundCtx.fill();
    }
    for (let i = 0; i < this.bushX.length; i++) {
      const yFraction = this.bushY[i];
      const x = this.bushX[i] * groundWidth;
      const y = GROUND_BASELINE + 4 + yFraction * 146;
      const scale = 0.7 + 0.9 * (yFraction * 0.7 + this.bushS[i] * 0.3);
      groundCtx.drawImage(this.brushBush, x - 12 * scale, y - 15 * scale, 24 * scale, 18 * scale);
    }
  }

  private drawGround(ctx: CanvasRenderingContext2D, v: View): void {
    const gy = groundScreenY(v.altitude, v.height);
    if (gy > v.height + 260) return;
    const fade = Math.min(1, Math.max(0, 1 - (v.altitude - 200) / 900));
    ctx.save();
    ctx.globalAlpha = 0.35 + fade * 0.65;

    const ridgeLayer = this.ridgeLayer;
    const groundLayer = this.groundLayer;
    if (ridgeLayer) {
      const ridgeX = -GROUND_PAD + GROUND_PAD * Math.tanh(v.driftX * 0.04 / GROUND_PAD);
      ctx.drawImage(ridgeLayer, ridgeX, gy - RIDGE_BASELINE);
    }
    if (groundLayer) {
      const groundX = -GROUND_PAD + GROUND_PAD * Math.tanh(v.driftX * 0.15 / GROUND_PAD);
      ctx.drawImage(groundLayer, groundX, gy - GROUND_BASELINE);
    }

    this.drawPad(ctx, v, gy);
    ctx.restore();
  }

  private drawPad(ctx: CanvasRenderingContext2D, v: View, gy: number): void {
    const cx = v.width * 0.5;

    // Pale launch slab and its shallow front face.
    ctx.fillStyle = '#ece0c8';
    ctx.fillRect(cx - 100, gy - 5, 200, 10);
    ctx.fillStyle = '#cdbba0';
    ctx.fillRect(cx - 100, gy + 5, 200, 5);

    // Tether reel.
    ctx.fillStyle = '#57534f';
    ctx.fillRect(cx + 58, gy - 24, 26, 18);
    ctx.strokeStyle = '#37332f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + 71, gy - 15, 7, 0, 6.283);
    ctx.stroke();

    // Ground station case + whip antenna.
    ctx.fillStyle = '#4b4743';
    ctx.fillRect(cx - 104, gy - 20, 30, 14);
    ctx.strokeStyle = '#37332f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 89, gy - 20);
    ctx.lineTo(cx - 92, gy - 52);
    ctx.stroke();

    // Windsock — reads the live wind.
    const mastX = cx + 128;
    ctx.strokeStyle = '#9a9084';
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
