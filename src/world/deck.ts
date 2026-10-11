import { makeBrush, rand } from './brush';
import type { View } from './scenery';
import type { LiveSky } from './sites/sky';

const BLEED = 24;

function smooth(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Two wrapped copies of a band `span` wide, drawing only the columns on screen. */
function tile(
  ctx: CanvasRenderingContext2D,
  band: HTMLCanvasElement,
  shift: number,
  span: number,
  top: number,
  height: number,
  viewWidth: number,
): void {
  const k = band.width / span;
  for (const start of [-shift - BLEED, span - shift - BLEED]) {
    const from = Math.max(start, -BLEED);
    const to = Math.min(start + span, viewWidth + BLEED);
    if (to <= from) continue;
    ctx.drawImage(band, (from - start) * k, 0, (to - from) * k, band.height, from, top, to - from, height);
  }
}

/**
 * A low stratus deck the ascent climbs through. From the pad it is a mottled
 * ceiling; inside it the whole frame goes to fog (drawn over the balloon);
 * above it, a bright sea of cloud tops sinks away below.
 */
export class OvercastDeck {
  private readonly brush = makeBrush(64, 0.2, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  private readonly brushDark = makeBrush(64, 0.15, 'rgba(0,0,0,1)', 'rgba(0,0,0,0)');
  private under: HTMLCanvasElement | undefined;
  private over: HTMLCanvasElement | undefined;
  private built = '';

  constructor(private readonly divisor: number) {}

  resize(): void {
    this.built = '';
  }

  /** Ceiling and cloud-sea pass, behind the ground and balloon. */
  draw(ctx: CanvasRenderingContext2D, v: View, sky: LiveSky, horizonY: number): void {
    const deck = sky.deck;
    if (!deck || sky.deckAmount < 0.01) return;
    const a = v.altitude;
    if (a > deck.top + 1400) return;
    this.build(v, sky);
    const span = v.width * 1.5;
    // Reduced motion holds the deck still; it does not creep with time or drift.
    let shift = v.reduced ? 0 : (v.time * 4 - v.driftX * 0.2) % span;
    if (shift < 0) shift += span;

    ctx.save();
    if (a < deck.base && this.under) {
      // The ceiling lowers toward the frame as the base approaches.
      const p = a / deck.base;
      const bottom = horizonY + (v.height + BLEED - horizonY) * p * p;
      ctx.globalAlpha = sky.deckAmount * (0.85 + 0.15 * p);
      tile(ctx, this.under, shift, span, -BLEED, bottom + BLEED, v.width);
    }
    if (a >= deck.base - 40 && this.over) {
      const q = (a - deck.base) / (deck.top - deck.base);
      const top = q <= 1 ? -0.15 * v.height + q * 0.9 * v.height : 0.75 * v.height + (a - deck.top) * 0.32;
      if (top < v.height + BLEED) {
        ctx.globalAlpha = sky.deckAmount * smooth(deck.base - 40, deck.base + 80, a) * (1 - smooth(deck.top + 700, deck.top + 1400, a));
        tile(ctx, this.over, shift, span, top, Math.max(v.height * 0.6, v.height + BLEED - top), v.width);
      }
    }
    ctx.restore();
  }

  /** The fog the balloon flies through; drawn over everything on #scene. */
  drawFog(ctx: CanvasRenderingContext2D, v: View, sky: LiveSky): void {
    const deck = sky.deck;
    if (!deck || sky.deckAmount < 0.01) return;
    const a = v.altitude;
    const inside = smooth(deck.base - 90, deck.base + 70, a) * (1 - smooth(deck.top - 160, deck.top + 30, a));
    if (inside < 0.01) return;
    const q = Math.min(1, Math.max(0, (a - deck.base) / (deck.top - deck.base)));
    const r = Math.round(deck.under[0] + (deck.over[0] - deck.under[0]) * q);
    const g = Math.round(deck.under[1] + (deck.over[1] - deck.under[1]) * q);
    const b = Math.round(deck.under[2] + (deck.over[2] - deck.under[2]) * q);
    ctx.save();
    ctx.globalAlpha = sky.deckAmount * inside * 0.82;
    ctx.fillStyle = `rgb(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)})`;
    ctx.fillRect(0, 0, v.width, v.height);
    ctx.restore();
  }

  private build(v: View, sky: LiveSky): void {
    const deck = sky.deck;
    if (!deck) return;
    const key = `${v.width}x${v.height}:${deck.under.join()}:${deck.over.join()}`;
    if (key === this.built) return;
    this.built = key;
    const d = this.divisor;
    const width = Math.ceil((v.width * 1.5) / d);
    const height = Math.ceil(v.height / d);
    this.under = this.paint(width, height, deck.under, true);
    this.over = this.paint(width, height, deck.over, false);
  }

  /**
   * One tileable band of stratus. `underside` is the cloud base seen from
   * below: grey rolls fading out toward the horizon. Otherwise it is the deck
   * seen from above, billows rising along a lit top edge.
   */
  private paint(width: number, height: number, tone: [number, number, number], underside: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const r = rand(underside ? 20261009 : 20261010);
    const [red, green, blue] = tone;
    const edge = underside ? height : height * 0.16;
    ctx.fillStyle = `rgb(${red},${green},${blue})`;
    ctx.fillRect(0, underside ? 0 : edge, width, underside ? height : height - edge);
    if (!underside) {
      // Billows along the top edge, wrapped so the band tiles horizontally.
      const billows = Math.ceil(width / 9);
      for (let i = 0; i < billows; i++) {
        const x = (i / billows) * width + (r() - 0.5) * 12;
        const radius = (0.05 + r() * 0.07) * height;
        const y = edge - r() * 0.6 * radius;
        for (const wrap of [x, x - width, x + width]) {
          ctx.beginPath();
          ctx.arc(wrap, y, radius, 0, 6.283);
          ctx.fill();
        }
      }
    }
    // Stratocumulus rolls: long, flat light and dark cells, smaller toward
    // the bottom of the band where the base recedes toward the horizon.
    ctx.globalCompositeOperation = 'source-atop';
    const cells = Math.ceil((width * height) / 180);
    for (let i = 0; i < cells; i++) {
      const y = r() * height;
      const depth = underside ? 1 - (y / height) * 0.7 : 1;
      const x = r() * width;
      const size = (0.03 + r() * 0.07) * height * depth;
      const light = underside ? r() < 0.45 : r() < 0.6;
      ctx.globalAlpha = light ? 0.06 + r() * 0.1 : 0.04 + r() * (underside ? 0.08 : 0.05);
      const stamp = light ? this.brush : this.brushDark;
      for (const wrap of [x, x - width, x + width]) {
        ctx.drawImage(stamp, wrap - size * 2.6, y - size * 0.4, size * 5.2, size * 0.8);
      }
    }
    // Lit tops, shaded bases.
    const shade = ctx.createLinearGradient(0, 0, 0, height);
    if (underside) {
      shade.addColorStop(0, 'rgba(255,255,255,0.06)');
      shade.addColorStop(1, 'rgba(20,24,32,0.22)');
    } else {
      shade.addColorStop(0, 'rgba(255,255,255,0.3)');
      shade.addColorStop(0.5, 'rgba(255,255,255,0)');
      shade.addColorStop(1, 'rgba(120,132,150,0.25)');
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    if (underside) {
      // The base thins out into the horizon haze instead of ending in an edge.
      ctx.globalCompositeOperation = 'destination-out';
      const fade = ctx.createLinearGradient(0, height * 0.55, 0, height);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, height * 0.55, width, height * 0.45);
    }
    return canvas;
  }
}
