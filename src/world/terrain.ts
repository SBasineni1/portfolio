import type { View } from './scenery';
import type { LaunchSite, Rgb, SiteLayer } from './sites/types';

/** Where a plate landed this frame; effects map master pixels through it. */
export interface PlateFrame {
  left: number;
  top: number;
  /** Screen pixels per master pixel. */
  scale: number;
  alpha: number;
}

/** Called after each plate is drawn, with the site that plate belongs to. */
export type PlateHook = (site: LaunchSite, index: number, frame: PlateFrame) => void;

/**
 * The light the photograph was taken in, measured off the near plate around
 * the pad, so anything placed on the site can be graded to match it.
 */
export interface PlateTone {
  /** Average ground colour around the pad (the bounce light). */
  ground: Rgb;
  /** The darker shadows in that ground (for contact and cast shadows). */
  shadow: Rgb;
}

const DEFAULT_TONE: PlateTone = { ground: [150, 142, 128], shadow: [44, 42, 40] };

/** drawn: plates are up. loading: nothing decoded yet. failed: use the fallback ground. */
export type TerrainState = 'drawn' | 'loading' | 'failed';

interface PlateSet {
  site: LaunchSite;
  images: HTMLImageElement[];
  /** Half-resolution copies flooded with the aerial colour, crossfaded in with altitude. */
  hazed: HTMLCanvasElement[];
  /** Source row below which each plate is fully opaque (it hides everything behind it). */
  solidRow: number[];
  /** Plates pre-scaled to device pixels so a frame blits instead of resampling. */
  scaled: HTMLCanvasElement[];
  scaledKey: string;
  ready: boolean;
  failed: boolean;
  tone: PlateTone;
}

const CROSSFADE = 0.45;
/** Decoded sites kept around (the ones on screen plus recent neighbours). */
const KEEP = 4;
/** Cache widths snap to this, so a phone's URL bar showing or hiding never rebuilds them. */
const CACHE_STEP = 64;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function dropCaches(set: PlateSet): void {
  set.scaled = [];
  set.scaledKey = '';
}

/**
 * The launch site's illustrated depth plates. Every plate shares the master
 * painting's canvas, and each has its own ground line —
 * `base + altitude · depthK` — so at the pad they reassemble the painting
 * exactly and, on the climb, the near apron falls away while far ranges
 * hardly move.
 *
 * Switching keeps the old plates up until the new ones decode, then
 * crossfades (a cut under reduced motion). A switch requested mid-fade waits
 * for that fade to finish, so nothing on screen ever jumps; a site whose
 * plates fail to load reverts to the one still showing. Up to KEEP decoded
 * sites are kept, least recently used released first.
 */
export class SiteTerrain {
  private readonly sets = new Map<string, PlateSet>();
  private current: PlateSet;
  private previous: PlateSet | undefined;
  private queued: PlateSet | undefined;
  /** 0..1 progress of current over previous (or over bare sky on first load). */
  private mix = 0;
  private lastTime = -1;
  private readonly frame: PlateFrame = { left: 0, top: 0, scale: 1, alpha: 1 };

  constructor(site: LaunchSite) {
    this.current = this.load(site);
  }

  /** The site the terrain is heading to, once any queued fade has run. */
  get site(): LaunchSite {
    return (this.queued ?? this.current).site;
  }

  /** The site whose plates dominate the frame right now. */
  get shown(): LaunchSite {
    const current = this.current.ready && (this.mix >= 0.5 || !this.previous?.ready);
    return current || !this.previous ? this.current.site : this.previous.site;
  }

  /** The measured light of the plates dominating the frame. */
  get tone(): PlateTone {
    const shown = this.shown;
    for (const set of [this.current, this.previous]) if (set?.site === shown && set.ready) return set.tone;
    return DEFAULT_TONE;
  }

  /** True once the target site has decoded and is fading in. */
  get settled(): boolean {
    return this.current.ready && !this.queued;
  }

  show(site: LaunchSite): void {
    const next = this.load(site);
    if (this.queued || (this.previous?.ready && this.current.ready && this.mix < 1)) {
      // A fade is running: let it finish, then go to the latest request.
      this.queued = next === this.current ? undefined : next;
    } else if (next === this.previous) {
      // Back to the site still on screen before the new one ever appeared.
      this.current = next;
      this.previous = undefined;
      this.mix = 1;
    } else if (next !== this.current) {
      if (this.current.ready) this.previous = this.current;
      this.current = next;
      this.mix = 0;
    }
    this.release();
  }

  preload(site: LaunchSite): void {
    this.load(site);
    this.release();
  }

  /** Drop the least recently used sets beyond KEEP; the HTTP cache keeps refetches cheap. */
  private release(): void {
    for (const [id, set] of this.sets) {
      if (this.sets.size <= KEEP) return;
      if (set === this.current || set === this.previous || set === this.queued) continue;
      this.sets.delete(id);
    }
  }

  private load(site: LaunchSite): PlateSet {
    const existing = this.sets.get(site.id);
    if (existing && !existing.failed) {
      // Map order is recency order.
      this.sets.delete(site.id);
      this.sets.set(site.id, existing);
      return existing;
    }
    const set: PlateSet = {
      site,
      images: [],
      hazed: [],
      solidRow: [],
      scaled: [],
      scaledKey: '',
      ready: false,
      failed: false,
      tone: DEFAULT_TONE,
    };
    let pending = site.layers.length;
    for (const layer of site.layers) {
      const image = new Image();
      image.decoding = 'async';
      image.src = layer.url;
      set.images.push(image);
      image
        .decode()
        .then(() => {
          pending--;
          if (pending > 0 || set.failed) return;
          set.hazed = set.images.map((plate) => makeHazed(plate, site));
          set.solidRow = set.images.map(solidRow);
          set.tone = measureTone(set.images[set.images.length - 1], site.groundRow);
          set.ready = true;
        })
        .catch(() => {
          set.failed = true;
        });
    }
    this.sets.set(site.id, set);
    return set;
  }

  draw(ctx: CanvasRenderingContext2D, v: View, base: number, hook: PlateHook): TerrainState {
    const dt = this.lastTime < 0 ? 0 : Math.min(0.1, Math.max(0, v.time - this.lastTime));
    this.lastTime = v.time;

    if (this.current.failed) {
      this.sets.delete(this.current.site.id);
      if (!this.previous) return 'failed';
      this.current = this.previous;
      this.previous = undefined;
      this.mix = 1;
    }
    if (this.current.ready && this.mix < 1) {
      this.mix = v.reduced ? 1 : Math.min(1, this.mix + dt / CROSSFADE);
    }
    if (this.mix >= 1 && this.previous) {
      dropCaches(this.previous);
      this.previous = undefined;
    }
    if (this.mix >= 1 && this.queued) {
      this.previous = this.current;
      this.current = this.queued;
      this.queued = undefined;
      this.mix = 0;
    }

    const previous = this.previous?.ready ? this.previous : undefined;
    if (!this.current.ready) {
      if (!previous) return 'loading';
      this.drawSet(ctx, v, base, previous, 1, hook);
      return 'drawn';
    }
    // A true crossfade: the old plates leave as the new ones arrive (the new
    // slightly ahead), so the old skyline never lingers in the new site's sky.
    if (previous) this.drawSet(ctx, v, base, previous, 1 - smooth(this.mix), hook);
    this.drawSet(ctx, v, base, this.current, previous ? smooth(Math.min(1, this.mix * 1.25)) : smooth(this.mix), hook);
    return 'drawn';
  }

  private drawSet(
    ctx: CanvasRenderingContext2D,
    v: View,
    base: number,
    set: PlateSet,
    alpha: number,
    hook: PlateHook,
  ): void {
    const first = set.images[0];
    const aspect = first.naturalWidth / first.naturalHeight;
    // Preserve the painting's proportions; phones crop it centrally.
    const minimumHeight = Math.max(480, Math.min(620, v.height * 0.62));
    const drawWidth = Math.max(v.width + 240, minimumHeight * aspect);
    const drawHeight = drawWidth / aspect;
    const scale = drawWidth / first.naturalWidth;
    // Wide screens show the painting centred; phones slide toward the
    // site's landmark, never past the plate's edges (with drift room).
    const narrow = Math.min(1, Math.max(0, (900 - v.width) / 400));
    const focus = 0.5 + (set.site.focusX - 0.5) * narrow;
    const centred = v.width * 0.5 - drawWidth * focus;
    const anchor = Math.min(-32, Math.max(v.width - drawWidth + 32, centred));
    // Device pixels per CSS pixel on this context. The soft-sky pass draws at
    // a twelfth of that and reads the source images directly instead.
    const ratio = ctx.getTransform().a;
    const cached = ratio >= 0.5;
    if (cached) ensureScaled(set, drawWidth, ratio);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    const layers = set.site.layers;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      let top = base + v.altitude * layer.depthK - drawHeight * set.site.groundRow;
      if (top > v.height + 24) continue;
      const fade = fadeOf(layer, v.altitude);
      if (fade <= 0) continue;
      // Stop where the next plate turns solid (or at the screen's edge):
      // painting the fill hidden behind it is pure overdraw.
      let bottom = Math.min(v.height + 24, top + drawHeight);
      const next = layers[i + 1];
      if (next && fadeOf(next, v.altitude) >= 1) {
        const nextTop = base + v.altitude * next.depthK - drawHeight * set.site.groundRow;
        bottom = Math.min(bottom, nextTop + set.solidRow[i + 1] * scale);
      }
      if (bottom <= top) continue;
      const offset = 32 * Math.tanh((v.driftX * layer.driftK) / 32);
      let left = anchor + offset;
      if (cached) {
        // Whole device pixels keep the blit close to a straight copy.
        left = Math.round(left * ratio) / ratio;
        top = Math.round(top * ratio) / ratio;
      }
      const height = Math.min(drawHeight, bottom - top + 1);
      ctx.globalAlpha = alpha * fade;
      const source = cached ? set.scaled[i] : set.images[i];
      blit(ctx, source, left, top, drawWidth, height, v.width);
      const haze = layerHaze(layer, v.altitude);
      if (haze > 0.005) {
        ctx.globalAlpha = alpha * fade * haze;
        blit(ctx, set.hazed[i], left, top, drawWidth, height, v.width);
      }
      // When the ground sits high (phones), the nearest plate ends above the
      // screen's bottom edge: run its last tenth on down, the nearest ground.
      const end = top + drawHeight;
      if (i === layers.length - 1 && end < v.height + 24) {
        ctx.globalAlpha = alpha * fade;
        stretchFoot(ctx, source, left, end, drawWidth, v.height + 24 - end, v.width);
        if (haze > 0.005) {
          ctx.globalAlpha = alpha * fade * haze;
          stretchFoot(ctx, set.hazed[i], left, end, drawWidth, v.height + 24 - end, v.width);
        }
      }
      this.frame.left = left;
      this.frame.top = top;
      this.frame.scale = scale;
      this.frame.alpha = alpha * fade;
      ctx.globalAlpha = 1;
      hook(set.site, i, this.frame);
    }
    ctx.restore();
  }
}

/**
 * Draw the visible part of a plate laid out at (left, top, drawWidth) and cut
 * off `height` CSS pixels down; columns outside the viewport are skipped.
 */
function blit(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  left: number,
  top: number,
  drawWidth: number,
  height: number,
  viewWidth: number,
): void {
  const from = Math.max(0, -24 - left);
  const to = Math.min(drawWidth, viewWidth + 24 - left);
  if (to <= from) return;
  const k = source.width / drawWidth;
  const sourceHeight = Math.min(source.height, height * k);
  ctx.drawImage(source, from * k, 0, (to - from) * k, sourceHeight, left + from, top, to - from, sourceHeight / k);
}

/** Stretch the bottom tenth of a plate over `height` px below `top` (visible columns only). */
function stretchFoot(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource & { width: number; height: number },
  left: number,
  top: number,
  drawWidth: number,
  height: number,
  viewWidth: number,
): void {
  const from = Math.max(0, -24 - left);
  const to = Math.min(drawWidth, viewWidth + 24 - left);
  if (to <= from || height <= 0) return;
  const k = source.width / drawWidth;
  const band = Math.max(2, source.height * 0.1);
  ctx.drawImage(source, from * k, source.height - band, (to - from) * k, band - 1, left + from, top - 1, to - from, height + 1);
}

function ensureScaled(set: PlateSet, drawWidth: number, ratio: number): void {
  const width = Math.ceil(drawWidth / CACHE_STEP) * CACHE_STEP;
  const key = `${width}:${ratio}`;
  if (set.scaledKey === key) return;
  set.scaledKey = key;
  set.scaled = set.images.map((image) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(((width * image.naturalHeight) / image.naturalWidth) * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  });
}

/** Aerial perspective: 0 at hazeFrom, 0.85 by hazeTo. */
function layerHaze(layer: SiteLayer, altitude: number): number {
  const t = clamp01((altitude - layer.hazeFrom) / (layer.hazeTo - layer.hazeFrom));
  return 0.85 * t * t * (3 - 2 * t);
}

/** Once fully hazed the plate dissolves into the sky over a further third of its range. */
function fadeOf(layer: SiteLayer, altitude: number): number {
  return 1 - clamp01((altitude - layer.hazeTo) / (layer.hazeTo * 0.35 + 300));
}

/**
 * Average the ground in a band around the pad (central half, groundRow ±6%),
 * and the darkest fifth of it for the shadow tone. Read from a small copy.
 */
function measureTone(image: HTMLImageElement, groundRow: number): PlateTone {
  const w = 256;
  const h = Math.max(1, Math.round((w * image.naturalHeight) / image.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return DEFAULT_TONE;
  ctx.drawImage(image, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return DEFAULT_TONE;
  }
  const y0 = Math.floor(h * (groundRow - 0.06));
  const y1 = Math.ceil(h * (groundRow + 0.06));
  const samples: Rgb[] = [];
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
    for (let x = Math.floor(w * 0.25); x < Math.ceil(w * 0.75); x++) {
      const k = (y * w + x) * 4;
      if (data[k + 3] > 250) samples.push([data[k], data[k + 1], data[k + 2]]);
    }
  }
  if (samples.length === 0) return DEFAULT_TONE;
  const mean = (list: Rgb[]): Rgb => {
    const sum: Rgb = [0, 0, 0];
    for (const c of list) {
      sum[0] += c[0];
      sum[1] += c[1];
      sum[2] += c[2];
    }
    return [sum[0] / list.length, sum[1] / list.length, sum[2] / list.length];
  };
  const luma = (c: Rgb): number => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  samples.sort((a, b) => luma(a) - luma(b));
  const dark = mean(samples.slice(0, Math.max(1, Math.floor(samples.length * 0.2))));
  // Shadows on the ground are darker than its darkest texture, same hue.
  return { ground: mean(samples), shadow: [dark[0] * 0.55, dark[1] * 0.55, dark[2] * 0.55] };
}

/**
 * The highest source row from which every column is opaque to the bottom.
 * Read at quarter width: a downsampled column is only opaque if all four of
 * its source columns are, so the estimate can only err toward drawing more.
 */
function solidRow(image: HTMLImageElement): number {
  const width = Math.ceil(image.naturalWidth / 4);
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return height;
  ctx.drawImage(image, 0, 0, width, height);
  let alpha: Uint8ClampedArray;
  try {
    alpha = ctx.getImageData(0, 0, width, height).data;
  } catch {
    // A cross-origin plate cannot be read back; skip the cropping, not the plate.
    return height;
  }
  let row = 0;
  for (let x = 0; x < width; x++) {
    let y = height - 1;
    while (y >= 0 && alpha[(y * width + x) * 4 + 3] === 255) y--;
    row = Math.max(row, y + 1);
  }
  return row;
}

function makeHazed(image: HTMLImageElement, site: LaunchSite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth / 2));
  canvas.height = Math.max(1, Math.round(image.naturalHeight / 2));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-atop';
  const [r, g, b] = site.sky.aerial;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
