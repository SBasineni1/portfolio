/**
 * A launch site: illustrated depth plates, the sky near the ground, and the
 * live effects that animate it. Plates come from tools/assets/plates.py and
 * share the master painting's canvas, so every coordinate below is a source
 * pixel of that master.
 */

export type Rgb = [number, number, number];

export interface SitePalette {
  top: Rgb;
  upper: Rgb;
  mid: Rgb;
  haze: Rgb;
  low: Rgb;
}

export interface SiteLayer {
  url: string;
  /**
   * Screen pixels this plate drops per metre of climb. The near apron uses
   * the shared GROUND_K so the pad gear stays seated; far ranges barely move.
   */
  depthK: number;
  /** Horizontal response to wind drift; nearer plates slide further. */
  driftK: number;
  /** Altitude band over which the plate hazes into the sky, then fades out. */
  hazeFrom: number;
  hazeTo: number;
}

export interface SiteSky {
  /** Sky bands at the pad; they merge into the shared ascent by blendTop. */
  ground: SitePalette;
  blendTop: number;
  /** Golden-hour weight on the low sky, haze and sun. */
  warmth: number;
  /** Sun position as a fraction of the viewport width. */
  sunX: number;
  /** Sun strength at the pad (an overcast pad dims it), 0..1. */
  sun: number;
  /** Colour the plates fade toward with altitude (aerial perspective). */
  aerial: Rgb;
}

/** A stratus deck the ascent climbs through. */
export interface SiteDeck {
  base: number;
  top: number;
  under: Rgb;
  over: Rgb;
}

export type SiteFx =
  | { kind: 'cloud-shadows'; layer: number; groundTop: number; strength: number }
  | { kind: 'dust'; layer: number; top: number; bottom: number; color: Rgb }
  | { kind: 'dust-devil'; layer: number; y: number; color: Rgb }
  | { kind: 'grass'; layer: number; top: number; bottom: number }
  | { kind: 'spindrift'; layer: number; top: number; bottom: number }
  | { kind: 'fog-bank'; layer: number; y: number; thickness: number }
  | { kind: 'summit-plume'; layer: number; x: number; y: number }
  | { kind: 'prayer-flags'; layer: number; from: [number, number]; to: [number, number]; sag: number }
  | { kind: 'beacon'; layer: number; x: number; y: number; phase: number }
  | { kind: 'anemometer'; layer: number; x: number; y: number }
  | { kind: 'birds'; layer: number; y: number; count: number };

/** Where a piece of gear stands: px right of the pad centre, px toward the camera. */
export type GearSpot = readonly [number, number];

/**
 * The launch staging area: a photographed pad under the balloon that suits
 * the site, and where each piece of gear stands around it. Offsets are at a
 * 1200px-wide viewport and shrink on narrower screens; a spot further toward
 * the camera draws a little larger.
 */
export interface SiteStage {
  pad: string;
  /** The pad's footprint centroid, in stored sprite px (tools/assets/gear.py). */
  centre: readonly [number, number];
  /** Vertical squash matching the site photograph's ground foreshortening. */
  squash: number;
  mast: GearSpot;
  receiver: GearSpot;
  cylinder: GearSpot;
  sock: GearSpot;
}

/**
 * The hero Polaroid's cloud holder, coloured for this site's light: its lit
 * top and its shaded underside. Muted on purpose — real clouds are never
 * pure white against a real sky.
 */
export interface SiteCloud {
  top: string;
  base: string;
}

export interface LaunchSite {
  id: string;
  label: string;
  /** Far to near. */
  layers: SiteLayer[];
  /** Fraction of the plate height where the pad gear sits. */
  groundRow: number;
  /** Fraction of the plate width phones centre on, so the landmark stays in frame. */
  focusX: number;
  sky: SiteSky;
  deck?: SiteDeck;
  fx: SiteFx[];
  stage: SiteStage;
  cloud: SiteCloud;
}
