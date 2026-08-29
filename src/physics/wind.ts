/**
 * Altitude-dependent wind field.
 *
 * Returns a horizontal acceleration in px/s^2 with a slow-varying gust
 * envelope plus cheap value noise for texture. Loosely shaped after a real
 * mid-latitude sounding: light and gusty near the surface, a strong
 * jet-stream maximum around 11 km, then a calm stratosphere.
 */

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 1D value noise in [-1, 1]. */
export function noise1(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i);
  const b = hash(i + 1);
  return (a + (b - a) * smooth(f)) * 2 - 1;
}

/** Two octaves; still only four hashes. */
export function fbm1(x: number): number {
  return noise1(x) * 0.65 + noise1(x * 2.37 + 11.3) * 0.35;
}

const GROUND_GUST = 130;
const JET_PEAK = 520;
const JET_CENTER = 11500;
const JET_WIDTH = 4200;

export interface WindSample {
  x: number;
  y: number;
  /** 0..1 magnitude relative to the jet peak, for scenery streaks. */
  strength: number;
}

const sample: WindSample = { x: 0, y: 0, strength: 0 };

export function windAt(altitude: number, time: number, calm: boolean): WindSample {
  if (calm) {
    sample.x = Math.sin(time * 0.35) * 14;
    sample.y = Math.sin(time * 0.27 + 1.4) * 8;
    sample.strength = 0.04;
    return sample;
  }

  // Surface layer: light mean flow, gusty.
  const surface = Math.exp(-altitude / 2600);
  const gust = (0.45 + 0.55 * fbm1(time * 0.55)) * fbm1(time * 0.21 + 4.2);
  const surfaceWind = surface * GROUND_GUST * (0.35 + gust);

  // Jet stream: gaussian band with a slow sinusoidal meander.
  const d = (altitude - JET_CENTER) / JET_WIDTH;
  const band = Math.exp(-d * d);
  const meander = 0.72 + 0.28 * Math.sin(time * 0.4) + 0.18 * fbm1(time * 0.9 + 21);
  const jet = band * JET_PEAK * meander;

  // Stratosphere: near-calm, long slow drift.
  const strat = Math.max(0, 1 - Math.exp(-(altitude - 18000) / 7000)) * 60 * Math.sin(time * 0.13);

  sample.x = surfaceWind + jet + strat;
  sample.y = fbm1(time * 0.8 + 60) * (18 + band * 55);
  sample.strength = Math.min(1, (surfaceWind * 0.25 + jet) / JET_PEAK);
  return sample;
}
