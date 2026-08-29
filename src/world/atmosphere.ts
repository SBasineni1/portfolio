/**
 * ICAO standard atmosphere (0-47 km) plus the altitude -> sky palette.
 */

export interface AtmosphereSample {
  /** Celsius. */
  temperature: number;
  /** hectopascals. */
  pressure: number;
  /** kg/m^3 */
  density: number;
}

const T0 = 288.15; // K at sea level
const P0 = 1013.25; // hPa at sea level
const R = 287.053;

const out: AtmosphereSample = { temperature: 15, pressure: 1013.25, density: 1.225 };

export function atmosphereAt(altitude: number): AtmosphereSample {
  const h = Math.max(0, altitude);
  let tK: number;
  let p: number;

  if (h < 11000) {
    tK = T0 - 0.0065 * h;
    p = P0 * Math.pow(tK / T0, 5.255877);
  } else if (h < 20000) {
    tK = 216.65;
    p = 226.32 * Math.exp(-0.00015769 * (h - 11000));
  } else if (h < 32000) {
    tK = 216.65 + 0.001 * (h - 20000);
    p = 54.749 * Math.pow(216.65 / tK, 34.1632);
  } else {
    tK = 228.65 + 0.0028 * (h - 32000);
    p = 8.6802 * Math.pow(228.65 / tK, 12.2011);
  }

  out.temperature = tK - 273.15;
  out.pressure = p;
  out.density = (p * 100) / (R * tK);
  return out;
}

/** Named atmospheric layer for the HUD / tape. */
export function layerName(altitude: number): string {
  if (altitude < 900) return 'SURFACE';
  if (altitude < 9000) return 'TROPOSPHERE';
  if (altitude < 17000) return 'TROPOPAUSE';
  if (altitude < 28000) return 'STRATOSPHERE';
  return 'NEAR SPACE';
}

/* ---------------------------------------------------------------- sky ---- */

interface SkyStop {
  alt: number;
  top: [number, number, number];
  mid: [number, number, number];
  low: [number, number, number];
}

// Warm daylight blue at the pad, deepening to an indigo-black at burst.
const SKY: SkyStop[] = [
  { alt: 0, top: [88, 148, 202], mid: [150, 194, 226], low: [226, 224, 206] },
  { alt: 2500, top: [64, 126, 190], mid: [126, 176, 216], low: [196, 214, 216] },
  { alt: 9000, top: [36, 92, 168], mid: [86, 142, 198], low: [148, 186, 214] },
  { alt: 16000, top: [18, 54, 126], mid: [44, 96, 166], low: [92, 142, 190] },
  { alt: 24000, top: [10, 26, 74], mid: [22, 52, 116], low: [50, 92, 150] },
  { alt: 31000, top: [6, 12, 38], mid: [12, 26, 68], low: [30, 56, 108] },
  { alt: 38000, top: [3, 4, 14], mid: [6, 12, 34], low: [18, 32, 70] },
];

const scratch: [number, number, number] = [0, 0, 0];

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
  into: [number, number, number],
): void {
  into[0] = a[0] + (b[0] - a[0]) * t;
  into[1] = a[1] + (b[1] - a[1]) * t;
  into[2] = a[2] + (b[2] - a[2]) * t;
}

export type SkyBand = 'top' | 'mid' | 'low';

/** rgb() string for one band of the sky gradient at a given altitude. */
export function skyColor(altitude: number, band: SkyBand, alpha = 1): string {
  let i = 0;
  while (i < SKY.length - 2 && altitude > SKY[i + 1].alt) i++;
  const a = SKY[i];
  const b = SKY[i + 1];
  const t = Math.min(1, Math.max(0, (altitude - a.alt) / (b.alt - a.alt)));
  lerp3(a[band], b[band], t, scratch);
  const r = Math.round(scratch[0]);
  const g = Math.round(scratch[1]);
  const bl = Math.round(scratch[2]);
  return alpha >= 1 ? `rgb(${r},${g},${bl})` : `rgba(${r},${g},${bl},${alpha})`;
}

/** 0 at the surface, 1 once the sky is dark enough for stars. */
export function starVisibility(altitude: number): number {
  return Math.min(1, Math.max(0, (altitude - 9000) / 16000)) ** 1.4;
}
