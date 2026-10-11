import cylinderUrl from '../assets/gear/helium.webp';
import mastUrl from '../assets/gear/met-mast.webp';
import receiverUrl from '../assets/gear/receiver.webp';
import sockUrl from '../assets/gear/windsock-cloth.webp';
import poleUrl from '../assets/gear/windsock-mast.webp';
import type { Touchable } from '../input';
import { blend, rgb, type Rgb, type SceneLight } from './paint';
import { DENSITY, PhotoSprite } from './photo';
import type { View } from './scenery';
import type { GearSpot, SiteStage } from './sites/types';

/**
 * The launch staging area: a photographed pad that suits the site, and the
 * gear standing around it per the site's layout (SiteStage) — photographs
 * of the real objects (keyed from
 * tools/assets/masters/gear by tools/assets/gear.py), with the parts that
 * move drawn live so they answer the wind and the pointer.
 *
 *   windsock   — a photo sock strip-warped along a centreline that fills,
 *                lifts and flaps with the wind; sweep the pointer through it
 *                to fan it, click to blow a gust (which reaches the balloon).
 *   met mast   — a weather-station tripod; its wind vane swings to face the
 *                wind and its cup anemometer spins at wind speed. Click to
 *                spin them; brush past to flick them.
 *   receiver   — the ground-station case and tripod; its antenna whip is a
 *                springy rod that wobbles when poked.
 *   cylinder   — the helium bottle; click it to crack the valve for a puff.
 *
 * Sprites (photo.ts) are graded to the site's photograph by the scene light,
 * and shadows use its measured shadow colour. On a site switch the gear
 * sinks away, then rises back in piece by piece once the new site shows. Under reduced motion
 * nothing moves and pokes do nothing.
 */

/** Sprite-pixel anchors, from tools/assets/gear.py. */
const POLE = { base: [19.9, 299.2], swivel: [22.1, 4] };
const SOCK = { mouth: [8, 29.1], tail: [219.4, 30.8], height: 58 };
const CYLINDER = { base: [26.1, 199.4], valve: [26.1, 0.4] };
const MAST = { base: [42.2, 275.2], vane: [11.5, 2.5], cups: [74.8, 6.3] };
const RECEIVER = { base: [116.1, 104.3], whip: [219.3, 0.8], tip: [219.3, -68.3] };

type Part = 'sock' | 'mast' | 'receiver' | 'cylinder';

interface Hit {
  part: Part;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

export class PadGear implements Touchable {
  private readonly pole = new PhotoSprite(poleUrl);
  private readonly sock = new PhotoSprite(sockUrl);
  private readonly cylinder = new PhotoSprite(cylinderUrl);
  private readonly mast = new PhotoSprite(mastUrl);
  private readonly receiver = new PhotoSprite(receiverUrl);
  /** Staging-pad photos, loaded per site as it is first shown. */
  private readonly pads = new Map<string, PhotoSprite>();

  private fill = 0.3;
  private gust = 0;
  private yaw = Math.PI;
  private yawVelocity = 0;
  private cupAngle = 0;
  private cupSpeed = 2;
  private whip = 0;
  private whipVelocity = 0;
  private readonly puffs: Puff[] = [];
  private lastTime = -1;
  private reduced = false;
  private hits: Hit[] = [];
  private valve = { x: 0, y: 0 };
  private whipX = 0;
  /** Set up on the pad ('in') or packed away for a site switch ('out'). */
  private phase: 'in' | 'out' = 'out';
  private phaseTime = 0;

  /** Called when a click on the windsock blows a gust, so the balloon feels it too. */
  constructor(private readonly onGust: (strength: number) => void) {}

  /** Forget last frame's hit areas; the gear re-registers them as it draws. */
  clearHits(): void {
    this.hits = [];
  }

  pick(x: number, y: number): boolean {
    return this.hitAt(x, y) !== undefined;
  }

  private hitAt(x: number, y: number): Part | undefined {
    for (const h of this.hits) if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return h.part;
    return undefined;
  }

  poke(x: number, y: number): void {
    if (this.reduced) return;
    const part = this.hitAt(x, y);
    if (part === 'sock') {
      this.gust = 1.2;
      this.onGust(0.45);
    } else if (part === 'mast') {
      this.yawVelocity += (Math.random() < 0.5 ? -1 : 1) * (10 + Math.random() * 6);
      this.cupSpeed += 24;
    } else if (part === 'receiver') {
      this.whipVelocity += x < this.whipX ? 9 : -9;
    } else if (part === 'cylinder') {
      this.hiss();
    }
  }

  brush(x: number, y: number, vx: number, vy: number): void {
    if (this.reduced) return;
    const part = this.hitAt(x, y);
    const speed = Math.hypot(vx, vy);
    if (part === 'sock') this.gust = Math.min(1.4, this.gust + speed / 2600);
    else if (part === 'mast') {
      this.yawVelocity += vx / 500;
      this.cupSpeed = Math.min(80, this.cupSpeed + speed / 240);
    } else if (part === 'receiver') this.whipVelocity += vx / 260;
  }

  private hiss(): void {
    for (let i = 0; i < 16; i++) {
      this.puffs.push({
        x: this.valve.x + 3,
        y: this.valve.y + 2,
        vx: 10 + Math.random() * 26,
        vy: -6 - Math.random() * 16,
        age: 0,
        life: 0.6 + Math.random() * 0.7,
      });
    }
  }

  private step(v: View): number {
    const dt = this.lastTime < 0 || v.reduced ? 0 : Math.min(0.05, Math.max(0, v.time - this.lastTime));
    this.lastTime = v.time;
    this.reduced = v.reduced;
    if (dt === 0) return 0;
    const wind = v.windStrength;
    // Sock: fills toward the wind plus any fanned or clicked gust.
    const target = Math.min(1, wind * 4 + 0.12 + this.gust);
    this.fill += (target - this.fill) * (1 - Math.exp(-dt * 3.2));
    this.gust *= Math.exp(-dt * 1.3);
    // Vane: a damped spring toward pointing into the wind (to the left).
    const into = Math.PI + Math.sin(v.time * 0.6) * 0.18 * (0.3 + wind);
    const stiffness = 5 + 34 * wind;
    this.yawVelocity += (-(this.yaw - into) * stiffness - this.yawVelocity * 2.1) * dt;
    this.yaw += this.yawVelocity * dt;
    // Cups: spin up and down toward wind speed.
    this.cupSpeed += (2 + wind * 30 - this.cupSpeed) * (1 - Math.exp(-dt * 0.9));
    this.cupAngle += this.cupSpeed * dt;
    // Whip: a stiff damped spring.
    this.whipVelocity += (-this.whip * 90 - this.whipVelocity * 4.2) * dt;
    this.whip += this.whipVelocity * dt;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age > p.life) {
        this.puffs.splice(i, 1);
        continue;
      }
      p.vx += (wind * 60 - p.vx) * dt * 1.5;
      p.vy *= Math.exp(-dt * 2);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    return dt;
  }

  /** Pack the gear away (a site switch has begun). */
  leave(): void {
    if (this.phase === 'out') return;
    this.phase = 'out';
    this.phaseTime = 0;
  }

  /** Set the gear back up (the new site's plates are showing). Idempotent. */
  arrive(): void {
    if (this.phase === 'in') return;
    this.phase = 'in';
    this.phaseTime = 0;
  }

  /**
   * How set-up gear item `index` is, 0..1. Leaving, everything sinks out
   * together in 0.22s; arriving, the pad goes down first and each piece
   * rises in after it over 0.5s, staggered, so the site is "set up" rather
   * than switched on.
   */
  private presence(index: number): number {
    if (this.reduced) return this.phase === 'in' ? 1 : 0;
    const t = this.phaseTime;
    const ease = (x: number): number => {
      const c = Math.min(1, Math.max(0, x));
      return 1 - (1 - c) ** 3;
    };
    if (this.phase === 'out') return 1 - ease(t / 0.22);
    return ease((t - 0.08 - index * 0.11) / 0.5);
  }

  private pad(url: string): PhotoSprite {
    let sprite = this.pads.get(url);
    if (!sprite) {
      sprite = new PhotoSprite(url);
      this.pads.set(url, sprite);
    }
    return sprite;
  }

  /** `onGround` paints shadows that fall on the pad, after it and before the gear. */
  draw(
    ctx: CanvasRenderingContext2D,
    v: View,
    l: SceneLight,
    tone: Rgb,
    cx: number,
    gy: number,
    stage: SiteStage,
    onGround: () => void,
  ): void {
    const dt = this.step(v);
    this.phaseTime += v.reduced ? 1 : dt;
    // Spots are laid out for a 1200px viewport and pull in on narrower ones.
    const spread = Math.min(1, Math.max(0.5, v.width / 1200));
    const at = (spot: GearSpot): [number, number, number] => [cx + spot[0] * spread, gy + spot[1], 1 + spot[1] / 240];
    const piece = (index: number, spot: GearSpot | undefined, paint: (x: number, y: number) => void): void => {
      const p = this.presence(index);
      if (p <= 0.01) return;
      const [x, y, scale] = spot ? at(spot) : [cx, gy, 1];
      const hits = this.hits.length;
      ctx.save();
      ctx.globalAlpha = p;
      // Rises out of / sinks into the ground plane, anchored at its foot;
      // a spot nearer the camera stands a little larger.
      ctx.translate(x, y + (1 - p) * 10);
      ctx.scale(scale, scale);
      ctx.translate(-x, -y);
      paint(x, y);
      ctx.restore();
      // Half-faded gear cannot be poked.
      if (p < 0.6) this.hits.length = hits;
    };
    // The staging pad goes down first, then the gear sets up around it.
    piece(0, undefined, () => this.drawStage(ctx, l, stage, cx, gy));
    onGround();
    piece(1, stage.mast, (x, y) => this.drawMast(ctx, l, tone, x, y));
    // Phones lose the receiver: there is no room beside the mast.
    if (v.width >= 560) piece(2, stage.receiver, (x, y) => this.drawReceiver(ctx, l, tone, x, y));
    piece(3, stage.cylinder, (x, y) => this.drawCylinder(ctx, l, tone, x, y, cx));
    piece(4, stage.sock, (x, y) => this.drawWindsock(ctx, v, l, tone, x, y));
  }

  /** The site's staging pad, flattened to the photograph's ground plane, centred under the balloon. */
  private drawStage(ctx: CanvasRenderingContext2D, l: SceneLight, stage: SiteStage, cx: number, gy: number): void {
    const pad = this.pad(stage.pad);
    if (!pad.ready) return;
    const w = pad.width;
    const h = pad.height * stage.squash;
    ctx.drawImage(pad.lit(l), cx - stage.centre[0] / DENSITY, gy + 4 - (stage.centre[1] / DENSITY) * stage.squash, w, h);
  }

  private hit(part: Part, x0: number, y0: number, x1: number, y1: number): void {
    this.hits.push({ part, x0, y0, x1, y1 });
  }

  private drawReceiver(ctx: CanvasRenderingContext2D, l: SceneLight, tone: Rgb, x: number, gy: number): void {
    if (!this.receiver.ready) return;
    castShadow(ctx, l, tone, x + 8, gy, 30, 70);
    this.receiver.draw(ctx, l, RECEIVER.base, x, gy);
    // The antenna whip: a white fibreglass rod, springing about its mount.
    const bx = x + (RECEIVER.whip[0] - RECEIVER.base[0]) / DENSITY;
    const by = gy + (RECEIVER.whip[1] - RECEIVER.base[1]) / DENSITY;
    const length = (RECEIVER.whip[1] - RECEIVER.tip[1]) / DENSITY;
    const tipX = bx + this.whip * 7;
    const tipY = by - length + Math.abs(this.whip) * 1.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgb(blend(l.shade, [120, 124, 130], 0.4));
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + this.whip * 1.5, by - length * 0.55, tipX, tipY);
    ctx.stroke();
    ctx.strokeStyle = rgb(blend(l.key, [255, 255, 255], 0.2));
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(bx - 0.4, by);
    ctx.quadraticCurveTo(bx - 0.4 + this.whip * 1.5, by - length * 0.55, tipX - 0.4, tipY);
    ctx.stroke();
    this.whipX = bx;
    this.hit('receiver', x - 44, gy - length - 40, x + 46, gy + 2);
  }

  private drawMast(ctx: CanvasRenderingContext2D, l: SceneLight, tone: Rgb, x: number, gy: number): void {
    if (!this.mast.ready) return;
    castShadow(ctx, l, tone, x, gy, 92, 20);
    this.mast.draw(ctx, l, MAST.base, x, gy);
    const metal = (amount: number): string => rgb(blend(blend(l.shade, l.key, amount), [150, 156, 162], 0.35));

    // Wind vane: an arrow on a spindle, foreshortened as it swings about
    // its vertical axis (seen from a little above).
    const vx = x + (MAST.vane[0] - MAST.base[0]) / DENSITY;
    const vy = gy + (MAST.vane[1] - MAST.base[1]) / DENSITY - 4;
    ctx.strokeStyle = metal(0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(vx, vy + 4);
    ctx.lineTo(vx, vy);
    ctx.stroke();
    const reach = 10;
    const ax = Math.cos(this.yaw) * reach;
    const ay = Math.sin(this.yaw) * reach * 0.22;
    // Shaft: arrowhead points into the wind, tail fin trails downwind.
    ctx.strokeStyle = metal(0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(vx - ax * 0.75, vy - ay * 0.75);
    ctx.lineTo(vx + ax, vy + ay);
    ctx.stroke();
    ctx.fillStyle = metal(0.8);
    ctx.beginPath();
    ctx.moveTo(vx + ax * 1.18, vy + ay * 1.18);
    ctx.lineTo(vx + ax * 0.9 - ay * 0.3, vy + ay * 0.9 - 1.8);
    ctx.lineTo(vx + ax * 0.9 + ay * 0.3, vy + ay * 0.9 + 1.8);
    ctx.closePath();
    ctx.fill();
    // Tail fin: a flat plate whose visible width follows the swing.
    const finX = vx - ax * 0.75;
    const finY = vy - ay * 0.75;
    const finW = Math.max(0.8, Math.abs(Math.sin(this.yaw)) * 4.5);
    const finDir = Math.cos(this.yaw) >= 0 ? -1 : 1;
    ctx.fillStyle = rgb(blend(blend(l.shade, l.key, 0.55 + 0.4 * Math.abs(Math.sin(this.yaw))), [236, 236, 232], 0.4));
    ctx.beginPath();
    ctx.moveTo(finX, finY - 3.8);
    ctx.lineTo(finX + finDir * finW, finY - 2.6);
    ctx.lineTo(finX + finDir * finW, finY + 2.6);
    ctx.lineTo(finX, finY + 3.8);
    ctx.closePath();
    ctx.fill();

    // Cup anemometer: three cups on arms, spinning about a vertical spindle.
    const cx = x + (MAST.cups[0] - MAST.base[0]) / DENSITY;
    const cy = gy + (MAST.cups[1] - MAST.base[1]) / DENSITY - 5;
    ctx.strokeStyle = metal(0.4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 5);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    const arm = 6.5;
    const cups: [number, number, number][] = [];
    for (let k = 0; k < 3; k++) {
      const a = this.cupAngle + (k * Math.PI * 2) / 3;
      cups.push([cx + Math.cos(a) * arm, cy + Math.sin(a) * arm * 0.25, Math.sin(a)]);
    }
    // Back cups first so the near ones overlap them.
    cups.sort((p, q) => p[2] - q[2]);
    ctx.lineWidth = 0.8;
    for (const [px, py, depth] of cups) {
      ctx.strokeStyle = metal(0.5);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = rgb(blend(blend(l.shade, l.key, 0.35 + 0.35 * (depth + 1) * 0.5), [40, 44, 50], 0.55));
      ctx.beginPath();
      ctx.ellipse(px, py, 1.9, 1.5, 0, 0, 6.283);
      ctx.fill();
    }
    this.hit('mast', x - 16, gy - 104, x + 18, gy + 2);
  }

  private drawCylinder(ctx: CanvasRenderingContext2D, l: SceneLight, tone: Rgb, x: number, gy: number, padX: number): void {
    if (!this.cylinder.ready) return;
    castShadow(ctx, l, tone, x, gy, 70, 16);
    // The fill hose runs on from the bottle's own hose to the pad.
    ctx.strokeStyle = rgb(blend(l.shade, [28, 30, 32], 0.7));
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 8, gy + 1);
    ctx.quadraticCurveTo((x + padX) / 2, gy + 8, padX + 4, gy + 2);
    ctx.stroke();
    this.cylinder.draw(ctx, l, CYLINDER.base, x, gy);
    this.valve.x = x;
    this.valve.y = gy + (CYLINDER.valve[1] - CYLINDER.base[1]) / DENSITY;
    // Vented helium: a quick white puff drifting off downwind.
    for (const p of this.puffs) {
      const t = p.age / p.life;
      const r = 2 + t * 9;
      ctx.fillStyle = `rgba(250,250,250,${0.5 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 6.283);
      ctx.fill();
    }
    this.hit('cylinder', x - 10, gy - 72, x + 12, gy + 2);
  }

  private drawWindsock(ctx: CanvasRenderingContext2D, v: View, l: SceneLight, tone: Rgb, x: number, gy: number): void {
    if (!this.pole.ready || !this.sock.ready) return;
    const height = (POLE.base[1] - POLE.swivel[1]) / DENSITY;
    castShadow(ctx, l, tone, x, gy, height, 4);
    this.pole.draw(ctx, l, POLE.base, x, gy);

    // The sock: the photo cut into strips laid along a curved centreline
    // that lifts toward horizontal as it fills, and flaps toward the tail.
    const sx = x + (POLE.swivel[0] - POLE.base[0]) / DENSITY + 1;
    const sy = gy - height + 2;
    const image = this.sock.lit(l);
    const fill = this.fill;
    const t = v.reduced ? 0 : v.time;
    const sourceLength = SOCK.tail[0] - SOCK.mouth[0];
    const length = (sourceLength / DENSITY) * (0.8 + 0.2 * fill);
    const droop = (1 - fill) * 1.25 + 0.05;
    const strips = 18;
    const thickness = (SOCK.height / DENSITY) * (0.5 + 0.5 * fill);
    let px = sx;
    let py = sy;
    for (let i = 0; i < strips; i++) {
      const u = (i + 0.5) / strips;
      const angle = droop * (0.25 + 0.75 * u) + Math.sin(t * 7 - u * 6) * 0.07 * fill * u;
      const segment = length / strips;
      const mx = px + Math.cos(angle) * segment * 0.5;
      const my = py + Math.sin(angle) * segment * 0.5;
      const srcX = SOCK.mouth[0] + (i / strips) * sourceLength;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(angle);
      ctx.drawImage(
        image,
        srcX,
        0,
        sourceLength / strips + 1,
        SOCK.height,
        -segment * 0.5 - 0.3,
        -thickness * (SOCK.mouth[1] / SOCK.height),
        segment + 0.6,
        thickness,
      );
      ctx.restore();
      px += Math.cos(angle) * segment;
      py += Math.sin(angle) * segment;
    }
    this.hit('sock', x - 8, sy - 14, x + length + 10, gy + 2);
  }
}

/**
 * A shadow cast along the ground away from the sun: a soft sliver as long as
 * the sun is low, shrinking to a contact smudge under overcast.
 */
function castShadow(ctx: CanvasRenderingContext2D, l: SceneLight, tone: Rgb, x: number, gy: number, height: number, width: number): void {
  const away = l.x >= 0 ? -1 : 1;
  const low = Math.abs(l.x) / Math.max(0.3, Math.abs(l.y));
  const length = Math.min(height * 2.4, height * 0.55 * low) * l.gloss;
  ctx.save();
  ctx.globalAlpha = 0.12 + 0.2 * l.gloss;
  ctx.fillStyle = rgb(tone);
  ctx.beginPath();
  ctx.moveTo(x - width * 0.5, gy);
  ctx.lineTo(x + away * length - width * 0.15, gy + 3 + length * 0.04);
  ctx.lineTo(x + away * length + width * 0.15, gy + 4 + length * 0.05);
  ctx.lineTo(x + width * 0.5, gy + 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.ellipse(x, gy + 0.5, width * 0.7 + 2, 2.2, 0, 0, 6.283);
  ctx.fill();
  ctx.restore();
}
