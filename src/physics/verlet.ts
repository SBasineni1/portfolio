/**
 * Minimal Verlet integrator with distance constraints.
 *
 * Everything lives in flat typed arrays so the simulation step allocates
 * nothing once the world is constructed. Positions are in screen pixels
 * (y grows downward); accelerations are px/s^2.
 */
export class VerletWorld {
  readonly capacity: number;
  count = 0;

  /** Current positions. */
  readonly px: Float32Array;
  readonly py: Float32Array;
  /** Positions at the start of the previous step (implicit velocity). */
  readonly ox: Float32Array;
  readonly oy: Float32Array;
  /** Force accumulator, already divided by mass (i.e. acceleration). */
  readonly ax: Float32Array;
  readonly ay: Float32Array;
  readonly invMass: Float32Array;
  /** Stored inverse mass, so pinning is reversible. */
  private readonly baseInvMass: Float32Array;

  private constraintCount = 0;
  private readonly ca: Int32Array;
  private readonly cb: Int32Array;
  private readonly rest: Float32Array;
  private readonly stiff: Float32Array;
  private readonly live: Uint8Array;

  constructor(capacity: number, constraintCapacity: number) {
    this.capacity = capacity;
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.ox = new Float32Array(capacity);
    this.oy = new Float32Array(capacity);
    this.ax = new Float32Array(capacity);
    this.ay = new Float32Array(capacity);
    this.invMass = new Float32Array(capacity);
    this.baseInvMass = new Float32Array(capacity);

    this.ca = new Int32Array(constraintCapacity);
    this.cb = new Int32Array(constraintCapacity);
    this.rest = new Float32Array(constraintCapacity);
    this.stiff = new Float32Array(constraintCapacity);
    this.live = new Uint8Array(constraintCapacity);
  }

  addPoint(x: number, y: number, mass: number): number {
    const i = this.count++;
    this.px[i] = x;
    this.py[i] = y;
    this.ox[i] = x;
    this.oy[i] = y;
    this.invMass[i] = 1 / mass;
    this.baseInvMass[i] = 1 / mass;
    return i;
  }

  addConstraint(a: number, b: number, rest: number, stiffness: number): number {
    const c = this.constraintCount++;
    this.ca[c] = a;
    this.cb[c] = b;
    this.rest[c] = rest;
    this.stiff[c] = stiffness;
    this.live[c] = 1;
    return c;
  }

  setRest(c: number, rest: number): void {
    this.rest[c] = rest;
  }

  setConstraintLive(c: number, on: boolean): void {
    this.live[c] = on ? 1 : 0;
  }

  setRangeLive(from: number, to: number, on: boolean): void {
    const v = on ? 1 : 0;
    for (let c = from; c < to; c++) this.live[c] = v;
  }

  /** Teleport a point, clearing its velocity. */
  place(i: number, x: number, y: number): void {
    this.px[i] = x;
    this.py[i] = y;
    this.ox[i] = x;
    this.oy[i] = y;
  }

  pin(i: number, x: number, y: number): void {
    this.invMass[i] = 0;
    this.place(i, x, y);
  }

  unpin(i: number): void {
    this.invMass[i] = this.baseInvMass[i];
  }

  isPinned(i: number): boolean {
    return this.invMass[i] === 0;
  }

  addAccel(i: number, x: number, y: number): void {
    this.ax[i] += x;
    this.ay[i] += y;
  }

  velX(i: number): number {
    return this.px[i] - this.ox[i];
  }

  velY(i: number): number {
    return this.py[i] - this.oy[i];
  }

  integrate(dt: number, damping: number): void {
    const dt2 = dt * dt;
    for (let i = 0; i < this.count; i++) {
      if (this.invMass[i] === 0) {
        this.ox[i] = this.px[i];
        this.oy[i] = this.py[i];
        this.ax[i] = 0;
        this.ay[i] = 0;
        continue;
      }
      const vx = (this.px[i] - this.ox[i]) * damping;
      const vy = (this.py[i] - this.oy[i]) * damping;
      this.ox[i] = this.px[i];
      this.oy[i] = this.py[i];
      this.px[i] += vx + this.ax[i] * dt2;
      this.py[i] += vy + this.ay[i] * dt2;
      this.ax[i] = 0;
      this.ay[i] = 0;
    }
  }

  solve(iterations: number): void {
    const n = this.constraintCount;
    for (let k = 0; k < iterations; k++) {
      for (let c = 0; c < n; c++) {
        if (this.live[c] === 0) continue;
        const a = this.ca[c];
        const b = this.cb[c];
        const wa = this.invMass[a];
        const wb = this.invMass[b];
        const w = wa + wb;
        if (w === 0) continue;
        let dx = this.px[b] - this.px[a];
        let dy = this.py[b] - this.py[a];
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1e-5) {
          d = 1e-5;
          dx = 1e-5;
          dy = 0;
        }
        const scale = ((d - this.rest[c]) / d) * this.stiff[c];
        const sx = dx * scale;
        const sy = dy * scale;
        this.px[a] += sx * (wa / w);
        this.py[a] += sy * (wa / w);
        this.px[b] -= sx * (wb / w);
        this.py[b] -= sy * (wb / w);
      }
    }
  }

  /** Render position, interpolated between the last two sim states. */
  rx(i: number, alpha: number): number {
    return this.ox[i] + (this.px[i] - this.ox[i]) * alpha;
  }

  ry(i: number, alpha: number): number {
    return this.oy[i] + (this.py[i] - this.oy[i]) * alpha;
  }

  /** Shift every point (used when the viewport resizes). */
  translateAll(dx: number, dy: number): void {
    for (let i = 0; i < this.count; i++) {
      this.px[i] += dx;
      this.py[i] += dy;
      this.ox[i] += dx;
      this.oy[i] += dy;
    }
  }
}
