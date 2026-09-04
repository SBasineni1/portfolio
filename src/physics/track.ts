const TRACK_SECONDS = 1.1;
export const EXIT_CLEARANCE = 420;

function smootherstep(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10);
}

export class ExitTrack {
  progress = 0;
  target = 0;
  homeY = 0;

  update(dt: number): void {
    const step = dt / TRACK_SECONDS;
    if (this.progress < this.target) this.progress = Math.min(this.target, this.progress + step);
    else if (this.progress > this.target) this.progress = Math.max(this.target, this.progress - step);
  }

  x(width: number): number {
    const t = smootherstep(this.progress);
    const mt = 1 - t;
    const start = width * 0.5;
    const control = width * 0.78;
    const end = width + EXIT_CLEARANCE;
    return mt * mt * start + 2 * mt * t * control + t * t * end;
  }

  y(height: number): number {
    const t = smootherstep(this.progress);
    const mt = 1 - t;
    const control = this.homeY - height * 0.12;
    const end = this.homeY - height * 0.06;
    return mt * mt * this.homeY + 2 * mt * t * control + t * t * end;
  }
}
