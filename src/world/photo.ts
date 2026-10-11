import { luma, type SceneLight } from './paint';

/** Photo sprites are stored at 3× their drawn size, for sharp edges on dense screens. */
export const DENSITY = 3;

/**
 * A keyed photograph of one object (see tools/assets/gear.py), drawn tinted
 * by the scene light so it takes each site's golden or overcast cast.
 */
export class PhotoSprite {
  readonly image = new Image();
  ready = false;
  private readonly tints = new Map<string, HTMLCanvasElement>();

  constructor(url: string) {
    this.image.decoding = 'async';
    this.image.src = url;
    this.image
      .decode()
      .then(() => {
        this.ready = true;
      })
      .catch(() => undefined);
  }

  get width(): number {
    return this.image.naturalWidth / DENSITY;
  }

  get height(): number {
    return this.image.naturalHeight / DENSITY;
  }

  /**
   * The photograph graded into the site's photograph: multiplied by the
   * scene's key light and scaled to the site's exposure (a bright desert
   * apron lifts it, dark asphalt holds it down), then washed 14% toward the
   * ground colour, the way everything outdoors picks up its surroundings.
   * Cached per quantised light.
   */
  lit(l: SceneLight): CanvasImageSource {
    const q = (n: number): number => Math.round(n * 32) / 32;
    const exposure = Math.min(1.12, Math.max(0.82, 0.78 + (0.3 * luma(l.ground)) / 150));
    const r = q(Math.min(1, (l.key[0] / 247) * exposure));
    const g = q(Math.min(1, (l.key[1] / 244) * exposure));
    const b = q(Math.min(1, (l.key[2] / 237) * exposure));
    const gr = Math.round(l.ground[0] / 8) * 8;
    const gg = Math.round(l.ground[1] / 8) * 8;
    const gb = Math.round(l.ground[2] / 8) * 8;
    const key = `${r},${g},${b}:${gr},${gg},${gb}`;
    const cached = this.tints.get(key);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = this.image.naturalWidth;
    canvas.height = this.image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return this.image;
    ctx.drawImage(this.image, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${r * 255},${g * 255},${b * 255})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = `rgb(${gr},${gg},${gb})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(this.image, 0, 0);
    if (this.tints.size > 8) this.tints.clear();
    this.tints.set(key, canvas);
    return canvas;
  }

  /** Draw with `anchor` (stored sprite px) at the current origin's (x, y). */
  draw(ctx: CanvasRenderingContext2D, l: SceneLight, anchor: readonly number[], x: number, y: number): void {
    ctx.drawImage(this.lit(l), x - anchor[0] / DENSITY, y - anchor[1] / DENSITY, this.width, this.height);
  }
}
