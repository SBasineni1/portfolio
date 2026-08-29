/**
 * Scroll -> altitude mapping.
 *
 * The first slice of the page is the launch phase (a leisurely 0 - 300 m so
 * the ground toy stays on screen while you start scrolling); the remainder is
 * linear up to burst altitude, which keeps the altitude tape honest and lets
 * sections map to exact scroll offsets.
 */

export const MAX_ALTITUDE = 35000;
export const LAUNCH_SPAN = 0.08;
export const LAUNCH_TOP = 300;
export const RELEASE_ALTITUDE = 55;

export function altitudeForProgress(t: number): number {
  const p = Math.min(1, Math.max(0, t));
  if (p <= LAUNCH_SPAN) return (p / LAUNCH_SPAN) * LAUNCH_TOP;
  const rest = (p - LAUNCH_SPAN) / (1 - LAUNCH_SPAN);
  return LAUNCH_TOP + rest * (MAX_ALTITUDE - LAUNCH_TOP);
}

export function progressForAltitude(altitude: number): number {
  if (altitude <= LAUNCH_TOP) return (altitude / LAUNCH_TOP) * LAUNCH_SPAN;
  const rest = (altitude - LAUNCH_TOP) / (MAX_ALTITUDE - LAUNCH_TOP);
  return LAUNCH_SPAN + rest * (1 - LAUNCH_SPAN);
}

export class Camera {
  /** Smoothed altitude actually used for rendering + physics. */
  altitude = 0;
  /** Raw altitude straight off the scroll position. */
  targetAltitude = 0;
  /** m/s, smoothed, for the HUD ascent readout. */
  ascentRate = 0;
  /** 0..1 across the whole page. */
  progress = 0;

  private lastAltitude = 0;

  readFromScroll(): void {
    const range = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this.progress = Math.min(1, Math.max(0, window.scrollY / range));
    this.targetAltitude = altitudeForProgress(this.progress);
  }

  step(dt: number): void {
    // Critically-damped-ish follow so flicking the scrollbar still reads as flight.
    const k = 1 - Math.exp(-dt * 6.5);
    this.altitude += (this.targetAltitude - this.altitude) * k;
    const instantaneous = (this.altitude - this.lastAltitude) / dt;
    this.lastAltitude = this.altitude;
    this.ascentRate += (instantaneous - this.ascentRate) * (1 - Math.exp(-dt * 3));
  }

  jumpTo(altitude: number): void {
    this.altitude = altitude;
    this.targetAltitude = altitude;
    this.lastAltitude = altitude;
    this.ascentRate = 0;
  }
}

/** Burst blend: 0 below 30 km, 1 at max scroll. */
export function burstAmount(altitude: number): number {
  return Math.min(1, Math.max(0, (altitude - 30500) / 3200));
}
