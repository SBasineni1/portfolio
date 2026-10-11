import type { Rgb, SiteDeck, SitePalette, SiteSky } from './types';

const BANDS = ['top', 'upper', 'mid', 'haze', 'low'] as const;

function copyPalette(palette: SitePalette): SitePalette {
  return {
    top: [...palette.top],
    upper: [...palette.upper],
    mid: [...palette.mid],
    haze: [...palette.haze],
    low: [...palette.low],
  };
}

function approach(into: Rgb, target: Rgb, k: number): void {
  into[0] += (target[0] - into[0]) * k;
  into[1] += (target[1] - into[1]) * k;
  into[2] += (target[2] - into[2]) * k;
}

/**
 * The site's near-ground sky, eased toward a new site over about half a
 * second so a site switch never snaps the whole atmosphere.
 */
export class LiveSky {
  readonly ground: SitePalette;
  blendTop: number;
  warmth: number;
  sunX: number;
  sun: number;
  /** The deck being drawn and how present it is (0..1), eased like the rest. */
  deck: SiteDeck | undefined;
  deckAmount: number;
  private target: SiteSky;
  private targetDeck: SiteDeck | undefined;

  constructor(sky: SiteSky, deck: SiteDeck | undefined) {
    this.target = sky;
    this.targetDeck = deck;
    this.ground = copyPalette(sky.ground);
    this.blendTop = sky.blendTop;
    this.warmth = sky.warmth;
    this.sunX = sky.sunX;
    this.sun = sky.sun;
    this.deck = deck;
    this.deckAmount = deck ? 1 : 0;
  }

  retarget(sky: SiteSky, deck: SiteDeck | undefined): void {
    this.target = sky;
    this.targetDeck = deck;
    if (deck) this.deck = deck;
  }

  step(dt: number, instant: boolean): void {
    const k = instant ? 1 : 1 - Math.exp(-dt * 7);
    const t = this.target;
    for (const band of BANDS) approach(this.ground[band], t.ground[band], k);
    this.blendTop += (t.blendTop - this.blendTop) * k;
    this.warmth += (t.warmth - this.warmth) * k;
    this.sunX += (t.sunX - this.sunX) * k;
    this.sun += (t.sun - this.sun) * k;
    const deckGoal = this.targetDeck ? 1 : 0;
    this.deckAmount += (deckGoal - this.deckAmount) * k;
    if (!this.targetDeck && this.deckAmount < 0.002) this.deck = undefined;
  }

  /** 1 at the pad, 0 once the site sky has merged into the shared ascent. */
  weight(altitude: number): number {
    const t = Math.min(1, Math.max(0, altitude / this.blendTop));
    return 1 - t * t * (3 - 2 * t);
  }
}
