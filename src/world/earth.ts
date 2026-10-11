import earthFull from '../assets/earth/earth-limb.webp';
import earthHalf from '../assets/earth/earth-limb-1920.webp';
import type { View } from './scenery';

/**
 * The Earth below near space: one static, high-resolution image rendered
 * offline by tools/assets/earth.py from NASA's Blue Marble (July, 21600 px,
 * topography and bathymetry) and its cloud layer, both public domain. The
 * camera hangs above the central United States looking north-east over the
 * Great Lakes.
 *
 * Nothing is rendered live: the image starts very wide, so the horizon
 * reads nearly flat at 5 km, and narrows toward the viewport width as the
 * balloon climbs, so the curvature grows. Loaded lazily above 2.5 km; 1920
 * wide on low-power devices.
 */
export class EarthImage {
  private image: HTMLImageElement | undefined;
  private ready = false;

  constructor(private readonly lowPower: boolean) {}

  load(): void {
    if (this.image) return;
    const image = new Image();
    image.decoding = 'async';
    image.src = this.lowPower ? earthHalf : earthFull;
    this.image = image;
    image
      .decode()
      .then(() => {
        this.ready = true;
      })
      .catch(() => undefined);
  }

  /** False until decoded, so the caller keeps its procedural limb. */
  draw(ctx: CanvasRenderingContext2D, v: View, alpha: number): boolean {
    const image = this.image;
    if (!this.ready || !image) return false;
    const t = Math.min(1, Math.max(0, (v.altitude - 4500) / 30500));
    const eased = 1 - (1 - t) ** 2;
    const aspect = image.naturalWidth / image.naturalHeight;
    // The top of the image is the atmosphere glow just above the horizon.
    let top = v.height * (0.9 - 0.2 * eased);
    let width = v.width * (3.1 - 1.95 * eased);
    // The image must always reach the bottom edge (stretching past it streaks).
    // A tall phone first takes a wider crop, up to 1.9 viewports so the curve
    // still reads, then sets the horizon lower for whatever is left.
    const cover = (v.height + 24 - top) * aspect;
    if (width < cover) {
      width = Math.max(width, Math.min(cover, v.width * 1.9));
      top = Math.max(top, v.height + 24 - width / aspect);
    }
    const height = width / aspect;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, (v.width - width) * 0.5, top, width, height);
    ctx.restore();
    return true;
  }
}
