import { VerletWorld } from './verlet';

/**
 * The whole flight article: a pressurised soft-body latex envelope, a
 * distance-constrained tether, a radiosonde payload, and a parachute that only
 * comes alive after burst.
 *
 * Screen pixels are the world units. Gravity is 1500 px/s^2 and every other
 * constant is tuned against that, by feel, at the launch pad.
 */

const GRAVITY = 1500;
const BUOYANCY = 2860; // per envelope point, ~1.9 g
const PRESSURE = 4300;
const DAMPING = 0.9974;
const DAMPING_CALM = 0.988;
const STATION_K = 55;
const STATION_C = 9.5;
const GRAB_K = 950;
const GRAB_C = 42;

const R_GROUND = 62;
const R_BURST = 152;
const CHUTE_SEG = 24;
const CHUTE_RISE = 96;

export interface BalloonEnv {
  altitude: number;
  anchored: boolean;
  burst: number;
  windX: number;
  windY: number;
  homeX: number;
  homeY: number;
  padX: number;
  padY: number;
  groundY: number;
  reduced: boolean;
  time: number;
}

export function envelopeRadius(altitude: number, burstRadius = R_BURST): number {
  const t = Math.min(1, Math.max(0, altitude / 32000));
  return R_GROUND + (burstRadius - R_GROUND) * Math.pow(t, 0.85);
}

export class Balloon {
  readonly world: VerletWorld;
  readonly ringCount: number;
  readonly ropeCount: number;
  readonly chuteCount: number;

  readonly ring: Int32Array;
  readonly rope: Int32Array;
  readonly chute: Int32Array;
  center = 0;
  neck = 0;
  payloadTop = 0;
  payloadBottom = 0;
  riser = 0;

  /** Unit-radius geometry, scaled by the current envelope radius. */
  private readonly shapeX: Float32Array;
  private readonly shapeY: Float32Array;
  private readonly unitNeighbor: Float32Array;
  private readonly unitSkip: Float32Array;
  private readonly unitSpoke: Float32Array;
  private readonly unitArea: number;
  private readonly shredSeed: Float32Array;

  private readonly cNeighbor: Int32Array;
  private readonly cSkip: Int32Array;
  private readonly cSpoke: Int32Array;
  private envFrom = 0;
  private envTo = 0;
  private chuteFrom = 0;
  private chuteTo = 0;

  private ropeSegment = 15;
  private radius = R_GROUND;
  private lastRadius = -1;
  private burst = 0;
  /** Eased 0..1 follow of the severed state; burst is an event, not a fade. */
  private burstMix = 0;
  private shredAge = 0;
  private anchored = true;
  private solverIterations: number;
  /** Full-inflation radius; smaller on phones so the envelope stays in frame. */
  private readonly burstRadius: number;

  private grabbed = -1;
  private grabX = 0;
  private grabY = 0;

  /** Set by update(), read by the renderer + HUD. */
  centroidX = 0;
  centroidY = 0;
  releaseFlash = 0;

  constructor(width: number, height: number, lowPower: boolean) {
    const N = lowPower ? 16 : 24;
    const ROPE = lowPower ? 10 : 14;
    const CHUTE = lowPower ? 7 : 9;
    this.ringCount = N;
    this.ropeCount = ROPE;
    this.chuteCount = CHUTE;
    this.solverIterations = lowPower ? 5 : 8;
    this.burstRadius = lowPower ? 112 : R_BURST;

    const points = N + 1 + ROPE + 2 + CHUTE;
    const constraints = N * 3 + ROPE + 3 + CHUTE * 2 + 4;
    this.world = new VerletWorld(points, constraints);

    this.ring = new Int32Array(N);
    this.rope = new Int32Array(ROPE);
    this.chute = new Int32Array(CHUTE);
    this.shapeX = new Float32Array(N);
    this.shapeY = new Float32Array(N);
    this.unitNeighbor = new Float32Array(N);
    this.unitSkip = new Float32Array(N);
    this.unitSpoke = new Float32Array(N);
    this.shredSeed = new Float32Array(N);
    this.cNeighbor = new Int32Array(N);
    this.cSkip = new Int32Array(N);
    this.cSpoke = new Int32Array(N);

    // Pear profile: full and round on top, tapering into the neck.
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const v = Math.sin(a);
      const f = 1 - 0.24 * Math.max(0, v) ** 1.5 + 0.05 * Math.max(0, -v);
      this.shapeX[i] = Math.cos(a) * f;
      this.shapeY[i] = v * f;
      this.shredSeed[i] = (i * 0.61803398875) % 1;
    }
    let area = 0;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const k = (i + 2) % N;
      this.unitNeighbor[i] = Math.hypot(this.shapeX[j] - this.shapeX[i], this.shapeY[j] - this.shapeY[i]);
      this.unitSkip[i] = Math.hypot(this.shapeX[k] - this.shapeX[i], this.shapeY[k] - this.shapeY[i]);
      this.unitSpoke[i] = Math.hypot(this.shapeX[i], this.shapeY[i]);
      area += this.shapeX[i] * this.shapeY[j] - this.shapeX[j] * this.shapeY[i];
    }
    this.unitArea = Math.abs(area) / 2;

    const cx = width * 0.5;
    const cy = height * 0.42;
    const w = this.world;

    for (let i = 0; i < N; i++) {
      this.ring[i] = w.addPoint(cx + this.shapeX[i] * R_GROUND, cy + this.shapeY[i] * R_GROUND, 1);
    }
    this.center = w.addPoint(cx, cy, 0.8);
    this.neck = this.ring[N / 2];

    const neckY = cy + R_GROUND;
    for (let i = 0; i < ROPE; i++) {
      this.rope[i] = w.addPoint(cx, neckY + (i + 1) * this.ropeSegment, 0.35);
    }
    const payY = neckY + (ROPE + 1) * this.ropeSegment;
    this.payloadTop = w.addPoint(cx, payY, 2);
    this.payloadBottom = w.addPoint(cx, payY + 26, 3);
    // The chute rides low on the tether so the payload hangs just below it.
    this.riser = this.rope[Math.max(1, Math.round(ROPE * 0.55))];

    for (let i = 0; i < CHUTE; i++) {
      this.chute[i] = w.addPoint(cx, neckY, 0.25);
      w.pin(this.chute[i], cx, neckY);
    }

    // --- constraints --------------------------------------------------
    this.envFrom = 0;
    for (let i = 0; i < N; i++) {
      this.cNeighbor[i] = w.addConstraint(this.ring[i], this.ring[(i + 1) % N], this.unitNeighbor[i] * R_GROUND, 0.55);
    }
    for (let i = 0; i < N; i++) {
      this.cSkip[i] = w.addConstraint(this.ring[i], this.ring[(i + 2) % N], this.unitSkip[i] * R_GROUND, 0.15);
    }
    for (let i = 0; i < N; i++) {
      this.cSpoke[i] = w.addConstraint(this.ring[i], this.center, this.unitSpoke[i] * R_GROUND, 0.12);
    }
    this.envTo = N * 3;

    w.addConstraint(this.neck, this.rope[0], this.ropeSegment, 1);
    for (let i = 0; i < ROPE - 1; i++) w.addConstraint(this.rope[i], this.rope[i + 1], this.ropeSegment, 1);
    w.addConstraint(this.rope[ROPE - 1], this.payloadTop, this.ropeSegment, 1);
    w.addConstraint(this.payloadTop, this.payloadBottom, 26, 1);

    this.chuteFrom = N * 3 + ROPE + 3;
    for (let i = 0; i < CHUTE - 1; i++) {
      w.addConstraint(this.chute[i], this.chute[i + 1], CHUTE_SEG, 0.9);
    }
    for (let i = 0; i < CHUTE; i++) {
      // Cord length has to match the canopy geometry or the dome collapses.
      const dx = (i - (CHUTE - 1) / 2) * CHUTE_SEG;
      w.addConstraint(this.chute[i], this.riser, Math.hypot(dx, CHUTE_RISE), 0.8);
    }
    this.chuteTo = this.chuteFrom + (CHUTE - 1) + CHUTE;
    w.setRangeLive(this.chuteFrom, this.chuteTo, false);

    this.updateRestLengths(R_GROUND);
  }

  private updateRestLengths(r: number): void {
    if (Math.abs(r - this.lastRadius) < 0.15) return;
    this.lastRadius = r;
    const w = this.world;
    for (let i = 0; i < this.ringCount; i++) {
      w.setRest(this.cNeighbor[i], this.unitNeighbor[i] * r);
      w.setRest(this.cSkip[i], this.unitSkip[i] * r);
      w.setRest(this.cSpoke[i], this.unitSpoke[i] * r);
    }
  }

  /* ------------------------------------------------------------- grab --- */

  /** Nearest grabbable point, or -1. */
  pick(x: number, y: number): number {
    const w = this.world;
    let best = -1;
    let bestD = Infinity;

    const dcx = x - this.centroidX;
    const dcy = y - this.centroidY;
    if (Math.hypot(dcx, dcy) < this.radius + 46) {
      for (let i = 0; i < this.ringCount; i++) {
        const p = this.ring[i];
        const d = Math.hypot(w.px[p] - x, w.py[p] - y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best >= 0) return best;
    }
    for (let i = 0; i < this.ropeCount; i++) {
      const p = this.rope[i];
      const d = Math.hypot(w.px[p] - x, w.py[p] - y);
      if (d < 24 && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    for (const p of [this.payloadTop, this.payloadBottom]) {
      const d = Math.hypot(w.px[p] - x, w.py[p] - y);
      if (d < 44 && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  grab(x: number, y: number): boolean {
    const p = this.pick(x, y);
    if (p < 0) return false;
    this.grabbed = p;
    this.grabX = x;
    this.grabY = y;
    return true;
  }

  moveGrab(x: number, y: number): void {
    this.grabX = x;
    this.grabY = y;
  }

  releaseGrab(): void {
    this.grabbed = -1;
  }

  get isGrabbing(): boolean {
    return this.grabbed >= 0;
  }

  /* ------------------------------------------------------------ burst --- */

  private sever(): void {
    const w = this.world;
    w.setRangeLive(this.envFrom, this.envTo, false);
    for (let i = 0; i < this.ringCount; i++) {
      const p = this.ring[i];
      const dx = w.px[p] - this.centroidX;
      const dy = w.py[p] - this.centroidY;
      const d = Math.hypot(dx, dy) || 1;
      const speed = 3.4 + this.shredSeed[i] * 2.6;
      w.ox[p] = w.px[p] - (dx / d) * speed;
      w.oy[p] = w.py[p] - (dy / d) * speed - 0.6;
    }
    this.shredAge = 0;
    const rx = w.px[this.riser];
    const ry = w.py[this.riser];
    for (let i = 0; i < this.chuteCount; i++) {
      const dx = (i - (this.chuteCount - 1) / 2) * CHUTE_SEG;
      const p = this.chute[i];
      w.unpin(p);
      w.place(p, rx + dx * 0.35, ry - CHUTE_RISE * 0.6);
    }
    w.setRangeLive(this.chuteFrom, this.chuteTo, true);
  }

  private reinflate(): void {
    const w = this.world;
    const nx = w.px[this.neck];
    const ny = w.py[this.neck];
    // Re-seed close to the equilibrium radius. Starting from a tiny circle
    // lets buoyancy stretch the ring into a folded, degenerate shape that
    // pressure alone cannot round out again.
    const r = this.radius * 0.85;
    for (let i = 0; i < this.ringCount; i++) {
      w.place(this.ring[i], nx + this.shapeX[i] * r, ny - this.radius * 0.9 + this.shapeY[i] * r);
    }
    w.place(this.center, nx, ny - this.radius * 0.9);
    w.setRangeLive(this.envFrom, this.envTo, true);
    w.setRangeLive(this.chuteFrom, this.chuteTo, false);
    for (let i = 0; i < this.chuteCount; i++) w.pin(this.chute[i], nx, ny);
  }

  setBurst(amount: number): void {
    const next = Math.min(1, Math.max(0, amount));
    if (this.burst < 0.02 && next >= 0.02) this.sever();
    else if (this.burst >= 0.02 && next < 0.02) this.reinflate();
    this.burst = next;
  }

  get burstAmount(): number {
    return this.burstMix;
  }

  /** True once the envelope constraints have been cut. */
  get severed(): boolean {
    return this.burst >= 0.02;
  }

  get shredFade(): number {
    return Math.max(0, 1 - this.shredAge / 3.2);
  }

  /* ------------------------------------------------------------ step ---- */

  update(dt: number, env: BalloonEnv): void {
    const w = this.world;
    this.radius = envelopeRadius(env.altitude, this.burstRadius);
    this.updateRestLengths(this.radius);
    this.setBurst(env.burst);
    this.burstMix += ((this.severed ? 1 : 0) - this.burstMix) * (1 - Math.exp(-dt * 7));
    if (this.burstMix > 0) this.shredAge += dt;

    if (env.anchored !== this.anchored) {
      this.anchored = env.anchored;
      if (!env.anchored) {
        w.unpin(this.payloadBottom);
        this.releaseFlash = 1;
      }
    }
    if (this.anchored) w.pin(this.payloadBottom, env.padX, env.padY);
    if (this.releaseFlash > 0) this.releaseFlash = Math.max(0, this.releaseFlash - dt * 1.1);

    // Centroid of the envelope ring.
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < this.ringCount; i++) {
      cx += w.px[this.ring[i]];
      cy += w.py[this.ring[i]];
    }
    cx /= this.ringCount;
    cy /= this.ringCount;
    this.centroidX = cx;
    this.centroidY = cy;

    // Gravity everywhere.
    for (let i = 0; i < w.count; i++) w.ay[i] += GRAVITY;

    const inflated = 1 - this.burstMix;

    if (inflated > 0.001) {
      const buoy = BUOYANCY * inflated;
      for (let i = 0; i < this.ringCount; i++) w.ay[this.ring[i]] -= buoy;
      w.ay[this.center] -= buoy;

      // Pressure: push the ring out along the radial when the enclosed area
      // has been squashed below its target.
      let area = 0;
      for (let i = 0; i < this.ringCount; i++) {
        const a = this.ring[i];
        const b = this.ring[(i + 1) % this.ringCount];
        area += w.px[a] * w.py[b] - w.px[b] * w.py[a];
      }
      area = Math.abs(area) / 2;
      const target = this.unitArea * this.radius * this.radius;
      // Watchdog: a ring folded flat (crushed against something, or left
      // degenerate by a fast reversal) cannot recover from pressure alone.
      if (area < target * 0.12) this.reinflate();
      let p = target / Math.max(area, 1) - 1;
      if (p > 1.5) p = 1.5;
      else if (p < -0.8) p = -0.8;
      const push = PRESSURE * p * inflated;
      for (let i = 0; i < this.ringCount; i++) {
        const idx = this.ring[i];
        const dx = w.px[idx] - cx;
        const dy = w.py[idx] - cy;
        const d = Math.hypot(dx, dy) || 1;
        w.ax[idx] += (dx / d) * push;
        w.ay[idx] += (dy / d) * push;
      }
    }

    // Wind, weighted by how much surface each part presents.
    const wx = env.windX;
    const wy = env.windY;
    const ringWind = 1 * inflated + 0.35 * this.burstMix;
    for (let i = 0; i < this.ringCount; i++) {
      const idx = this.ring[i];
      const lean = 1 + (w.py[idx] - cy) / (this.radius * 6);
      w.ax[idx] += wx * ringWind * lean;
      w.ay[idx] += wy * ringWind;
    }
    for (let i = 0; i < this.ropeCount; i++) {
      w.ax[this.rope[i]] += wx * 0.42;
      w.ay[this.rope[i]] += wy * 0.42;
    }
    w.ax[this.payloadTop] += wx * 0.18;
    w.ax[this.payloadBottom] += wx * 0.16;
    if (this.burstMix > 0) {
      // Shreds are light latex: heavy drag, then they tumble out of frame.
      for (let i = 0; i < this.ringCount; i++) {
        const idx = this.ring[i];
        w.ax[idx] -= (w.velX(idx) / dt) * 2.4 * this.burstMix;
        w.ay[idx] -= (w.velY(idx) / dt) * 2.4 * this.burstMix;
      }
      for (let i = 0; i < this.chuteCount; i++) {
        w.ax[this.chute[i]] += wx * 1.5;
        // Canopy drag: resist descent hard, so the payload settles.
        const vy = w.velY(this.chute[i]);
        w.ay[this.chute[i]] += -vy * 5200 * this.burstMix - GRAVITY * 0.35;
      }
    }

    // Station keeping. Once released, this is the "camera" holding the balloon
    // in frame; it reads as a steady ascent rather than a spring.
    if (!this.anchored) {
      const k = this.grabbed >= 0 ? STATION_K * 0.3 : STATION_K;
      const c = this.grabbed >= 0 ? STATION_C * 0.5 : STATION_C;
      // Horizontal recentring is much softer, so gusts still bend the flight
      // path and the balloon drifts the way a real sonde does.
      const hold = 1 - this.burstMix;
      if (hold > 0.001) {
        const fy = (env.homeY - cy) * k * hold;
        const fx = (env.homeX - cx) * k * 0.3 * hold;
        for (let i = 0; i < this.ringCount; i++) {
          const idx = this.ring[i];
          w.ax[idx] += fx - (w.velX(idx) / dt) * c * 0.3 * hold;
          w.ay[idx] += fy - (w.velY(idx) / dt) * c * hold;
        }
      }
      // After burst the camera subject becomes the parachute, so the payload
      // stays in frame while the shreds fall away.
      if (this.burstMix > 0.001) {
        let ax = 0;
        let ay = 0;
        for (let i = 0; i < this.chuteCount; i++) {
          ax += w.px[this.chute[i]];
          ay += w.py[this.chute[i]];
        }
        ax /= this.chuteCount;
        ay /= this.chuteCount;
        // Stiffer than the envelope hold: the canopy is carrying the payload,
        // so a soft spring would sag it off the bottom of the screen.
        const ck = k * 2.4;
        const fy = (env.homeY - 120 - ay) * ck * this.burstMix;
        const fx = (env.homeX - ax) * ck * 0.3 * this.burstMix;
        for (let i = 0; i < this.chuteCount; i++) {
          const idx = this.chute[i];
          w.ax[idx] += fx - (w.velX(idx) / dt) * c * 0.4 * this.burstMix;
          w.ay[idx] += fy - (w.velY(idx) / dt) * c * 1.4 * this.burstMix;
        }
      }
    }

    if (this.grabbed >= 0) {
      this.applyGrab(dt);
    }

    const damping = env.reduced ? DAMPING_CALM : DAMPING;
    w.integrate(dt, damping);
    w.solve(this.solverIterations);

    // Ground plane. Only the tether and payload collide: clamping the
    // envelope would flatten the ring into a degenerate line the pressure
    // solver can never round out again (and the ground sweeps up through the
    // balloon when you scroll back down fast).
    const g = env.groundY;
    for (let i = 0; i < this.ropeCount; i++) this.clampToGround(this.rope[i], g);
    this.clampToGround(this.payloadTop, g);
    this.clampToGround(this.payloadBottom, g);
  }

  private clampToGround(i: number, g: number): void {
    const w = this.world;
    if (w.py[i] <= g) return;
    w.py[i] = g;
    w.ox[i] += (w.px[i] - w.ox[i]) * 0.5;
    w.oy[i] = w.py[i] + 0.2;
  }

  private applyGrab(dt: number): void {
    const w = this.world;
    const p = this.grabbed;
    const spread = this.ringIndexOf(p);
    const push = (idx: number, weight: number) => {
      const ax = (this.grabX - w.px[idx]) * GRAB_K * weight - (w.velX(idx) / dt) * GRAB_C * weight;
      const ay = (this.grabY - w.py[idx]) * GRAB_K * weight - (w.velY(idx) / dt) * GRAB_C * weight;
      w.ax[idx] += ax;
      w.ay[idx] += ay;
    };
    push(p, 1);
    if (spread >= 0) {
      const n = this.ringCount;
      push(this.ring[(spread + 1) % n], 0.3);
      push(this.ring[(spread + n - 1) % n], 0.3);
      push(this.ring[(spread + 2) % n], 0.1);
      push(this.ring[(spread + n - 2) % n], 0.1);
    }
  }

  private ringIndexOf(point: number): number {
    for (let i = 0; i < this.ringCount; i++) if (this.ring[i] === point) return i;
    return -1;
  }

  /** Re-centre the whole assembly after a viewport resize. */
  recenter(dx: number, dy: number): void {
    this.world.translateAll(dx, dy);
    this.centroidX += dx;
    this.centroidY += dy;
  }
}
