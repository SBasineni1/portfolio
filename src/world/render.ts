import type { Balloon } from '../physics/balloon';
import chuteUrl from '../assets/gear/chute.webp';
import sondeUrl from '../assets/gear/sonde.webp';
import unwinderUrl from '../assets/gear/unwinder.webp';
import { blend, lit, rgb, type Rgb, type SceneLight } from './paint';
import { DENSITY, PhotoSprite } from './photo';

/** Photographs of the flight train (tools/assets/gear.py); painted stand-ins draw until they decode. */
const chutePhoto = new PhotoSprite(chuteUrl);
const sondePhoto = new PhotoSprite(sondeUrl);
const unwinderPhoto = new PhotoSprite(unwinderUrl);
const CHUTE = { apex: [22.6, 0.3] };
const SONDE = { body: [14.2, 89.7], antenna: [15.7, 129.1] };
const UNWINDER = { centre: [9.9, 20.3] };

/**
 * Canvas rendering for the flight article. Kept apart from the simulation so
 * balloon.ts stays pure physics.
 *
 * The balloon is painted live in the scenery's cel-shaded language rather
 * than drawn from a photograph: broad lit and shadow masses split by a soft
 * terminator, a cool sky rim on the shadow side, a soft gather into the neck,
 * the site's ground colour bounced up onto its underside near the pad, and
 * one highlight. All of it
 * is laid over the Verlet silhouette, so a grab still pinches the paint and
 * pressure still bulges it, and all of it is lit by the scene (SceneLight).
 */

export interface DrawOptions {
  time: number;
  reduced: boolean;
  alpha: number;
  fade: number;
  light: SceneLight;
}

const CHUTE_LIT: Rgb = [232, 92, 40];
const CHUTE_SHADE: Rgb = [176, 56, 28];
const STYRO: Rgb = [242, 241, 236];
const METAL: Rgb = [168, 172, 176];

export function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  if (o.fade <= 0.005) return;
  const w = b.world;
  const a = o.alpha;
  const inflated = 1 - b.burstAmount;

  drawTether(ctx, b, o);
  drawUnwinder(ctx, b, o);
  drawBundle(ctx, b, o);
  if (b.burstAmount > 0.01) drawParachute(ctx, b, o);
  if (!b.severed) drawEnvelope(ctx, b, o, inflated);
  else if (!o.reduced) drawShreds(ctx, b, o);
  drawPayload(ctx, b, o);

  if (b.releaseFlash > 0) {
    const t = 1 - b.releaseFlash;
    ctx.save();
    ctx.globalAlpha = b.releaseFlash * 0.6 * o.fade;
    ctx.strokeStyle = 'rgba(240,162,28,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.rx(b.payloadBottom, a), w.ry(b.payloadBottom, a), 18 + t * 150, 0, 6.283);
    ctx.stroke();
    ctx.restore();
  }
}

function traceRing(ctx: CanvasRenderingContext2D, b: Balloon, alpha: number): void {
  const w = b.world;
  const n = b.ringCount;
  ctx.beginPath();
  let px = (w.rx(b.ring[n - 1], alpha) + w.rx(b.ring[0], alpha)) / 2;
  let py = (w.ry(b.ring[n - 1], alpha) + w.ry(b.ring[0], alpha)) / 2;
  ctx.moveTo(px, py);
  for (let i = 0; i < n; i++) {
    const cx = w.rx(b.ring[i], alpha);
    const cy = w.ry(b.ring[i], alpha);
    const j = (i + 1) % n;
    px = (cx + w.rx(b.ring[j], alpha)) / 2;
    py = (cy + w.ry(b.ring[j], alpha)) / 2;
    ctx.quadraticCurveTo(cx, cy, px, py);
  }
  ctx.closePath();
}

function drawEnvelope(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions, inflated: number): void {
  const w = b.world;
  const a = o.alpha;
  const l = o.light;
  const n = b.ringCount;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += w.rx(b.ring[i], a);
    cy += w.ry(b.ring[i], a);
  }
  cx /= n;
  cy /= n;
  const r = b.envelopeR;
  const nx = w.rx(b.neck, a);
  const ny = w.ry(b.neck, a);

  ctx.save();
  ctx.globalAlpha = Math.min(1, inflated * 1.6) * o.fade;
  traceRing(ctx, b, a);

  // Body: a lit mass toward the light and a shadow mass away from it, split
  // by a short soft terminator — the scenery's cel-shading, not airbrush.
  const middle = blend(l.key, l.shade, 0.5);
  const ox = cx + l.x * r * 0.42;
  const oy = cy + l.y * r * 0.42;
  const body = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 1.4);
  body.addColorStop(0, rgb(blend(l.key, [255, 255, 255], 0.35)));
  body.addColorStop(0.3, rgb(l.key));
  body.addColorStop(0.5, rgb(l.key));
  body.addColorStop(0.58, rgb(middle));
  body.addColorStop(0.68, rgb(l.shade));
  body.addColorStop(1, rgb(blend(l.shade, [40, 48, 66], 0.16)));
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // Sky bounce: a cool rim along the shadow-side edge.
  const rim = ctx.createLinearGradient(cx + l.x * r, cy + l.y * r, cx - l.x * r, cy - l.y * r);
  rim.addColorStop(0, rgb(l.rim, 0));
  rim.addColorStop(0.62, rgb(l.rim, 0));
  rim.addColorStop(1, rgb(l.rim, 0.7));
  ctx.strokeStyle = rim;
  ctx.lineWidth = r * 0.2;
  ctx.stroke();

  // Bounce light: near the pad the underside picks up the colour of the
  // site's ground (warm off a desert apron, green off the station lawn).
  if (l.bounce > 0.01) {
    const bounce = ctx.createLinearGradient(cx, cy + r, cx, cy - r * 0.1);
    bounce.addColorStop(0, rgb(l.ground, 0.42 * l.bounce));
    bounce.addColorStop(1, rgb(l.ground, 0));
    ctx.fillStyle = bounce;
    ctx.fillRect(cx - r * 1.2, cy - r * 0.1, r * 2.4, r * 1.2);
  }

  // The latex gathering into the neck sits in its own soft shadow.
  const gather = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 0.55);
  gather.addColorStop(0, rgb(l.shade, 0.55));
  gather.addColorStop(1, rgb(l.shade, 0));
  ctx.fillStyle = gather;
  ctx.fillRect(nx - r * 0.55, ny - r * 0.55, r * 1.1, r * 1.1);

  // One highlight, toward the light, in direct sun only.
  if (l.gloss > 0.02) {
    const hx = cx + l.x * r * 0.5;
    const hy = cy + l.y * r * 0.5;
    const hr = r * 0.3;
    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
    glow.addColorStop(0, `rgba(255,255,255,${0.8 * l.gloss})`);
    glow.addColorStop(0.35, `rgba(255,255,255,${0.42 * l.gloss})`);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Math.atan2(l.y, l.x) + Math.PI / 2);
    ctx.scale(1, 0.62);
    ctx.translate(-hx, -hy);
    ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
    ctx.restore();
  }
  ctx.restore();

  // A restrained outline, darker on the shadow side.
  const edge = ctx.createLinearGradient(cx + l.x * r, cy + l.y * r, cx - l.x * r, cy - l.y * r);
  const ink = blend(l.shade, [36, 42, 58], 0.45);
  edge.addColorStop(0, rgb(ink, 0.12));
  edge.addColorStop(1, rgb(ink, 0.55));
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();

  drawNeck(ctx, o, nx, ny, cx, cy, inflated);
}

/** The tied latex neck and its cord wrap, pointing away from the envelope. */
function drawNeck(
  ctx: CanvasRenderingContext2D,
  o: DrawOptions,
  nx: number,
  ny: number,
  cx: number,
  cy: number,
  inflated: number,
): void {
  const l = o.light;
  const angle = Math.atan2(ny - cy, nx - cx) - Math.PI / 2;
  ctx.save();
  ctx.globalAlpha = inflated * o.fade;
  ctx.translate(nx, ny);
  ctx.rotate(angle);
  const side = Math.sign(l.x * Math.cos(angle) + l.y * Math.sin(angle)) || 1;
  ctx.fillStyle = rgb(blend(l.key, l.shade, 0.3));
  ctx.beginPath();
  ctx.moveTo(-5.5, -3);
  ctx.quadraticCurveTo(0, -5, 5.5, -3);
  ctx.lineTo(3, 11);
  ctx.lineTo(-3, 11);
  ctx.closePath();
  ctx.fill();
  // Shadowed half of the tube.
  ctx.fillStyle = rgb(l.shade, 0.75);
  ctx.beginPath();
  ctx.moveTo(0, -4.5);
  ctx.lineTo(5.5 * -side, -3);
  ctx.lineTo(3 * -side, 11);
  ctx.lineTo(0, 11);
  ctx.closePath();
  ctx.fill();
  // Cord wrap.
  ctx.fillStyle = rgb(lit([120, 104, 84], l, 0.6));
  ctx.fillRect(-3.6, 6, 7.2, 2.4);
  ctx.restore();
}

function drawShreds(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  const fade = b.shredFade;
  if (fade <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgb(blend(o.light.key, o.light.shade, 0.35));
  for (let i = 0; i < b.ringCount; i++) {
    const p = b.ring[i];
    const x = w.rx(p, a);
    const y = w.ry(p, a);
    const vx = w.velX(p);
    const vy = w.velY(p);
    const ang = Math.atan2(vy, vx);
    const len = 12 + (i % 5) * 5;
    ctx.globalAlpha = fade * 0.9 * o.fade;
    ctx.lineWidth = 2.5 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * len * 0.5, y - Math.sin(ang) * len * 0.5);
    ctx.quadraticCurveTo(x + Math.sin(ang) * 7, y - Math.cos(ang) * 7, x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParachute(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  const l = o.light;
  const n = b.chuteCount;
  const open = b.burstAmount;
  ctx.save();
  ctx.globalAlpha = Math.min(1, open * 1.4) * o.fade;

  // The chute points are the hem; the canopy is a dome bulged above them.
  const fx = w.rx(b.chute[0], a);
  const fy = w.ry(b.chute[0], a);
  const lx = w.rx(b.chute[n - 1], a);
  const ly = w.ry(b.chute[n - 1], a);
  const span = Math.hypot(lx - fx, ly - fy) || 1;
  const ux = (lx - fx) / span;
  const uy = (ly - fy) / span;
  const nx = uy;
  const ny = -ux;
  const dome = span * 0.66;

  ctx.beginPath();
  ctx.moveTo(fx, fy);
  for (let i = 1; i < n; i++) {
    const x0 = w.rx(b.chute[i - 1], a);
    const y0 = w.ry(b.chute[i - 1], a);
    const x1 = w.rx(b.chute[i], a);
    const y1 = w.ry(b.chute[i], a);
    ctx.quadraticCurveTo((x0 + x1) / 2 - nx * 6, (y0 + y1) / 2 - ny * 6, x1, y1);
  }
  ctx.bezierCurveTo(lx + nx * dome, ly + ny * dome, fx + nx * dome, fy + ny * dome, fx, fy);
  ctx.closePath();

  // Lit on the side facing the light, in the same two-mass shading as the envelope.
  const midX = (fx + lx) / 2 + nx * dome * 0.4;
  const midY = (fy + ly) / 2 + ny * dome * 0.4;
  const g = ctx.createLinearGradient(midX + l.x * span * 0.5, midY + l.y * span * 0.5, midX - l.x * span * 0.5, midY - l.y * span * 0.5);
  g.addColorStop(0, rgb(lit(CHUTE_LIT, l, 1)));
  g.addColorStop(0.45, rgb(lit(CHUTE_LIT, l, 1)));
  g.addColorStop(0.6, rgb(lit(CHUTE_SHADE, l, 0.8)));
  g.addColorStop(1, rgb(lit(CHUTE_SHADE, l, 0.55)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,40,18,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Panel seams.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,44,20,0.4)';
  ctx.beginPath();
  const apexX = (fx + lx) / 2 + nx * dome * 0.72;
  const apexY = (fy + ly) / 2 + ny * dome * 0.72;
  for (let i = 1; i < n - 1; i++) {
    ctx.moveTo(w.rx(b.chute[i], a), w.ry(b.chute[i], a));
    ctx.lineTo(apexX, apexY);
  }
  ctx.stroke();
  ctx.restore();

  // Cords.
  ctx.strokeStyle = rgb(blend(l.key, l.shade, 0.3), 0.8);
  ctx.lineWidth = 0.9;
  const rx = w.rx(b.riser, a);
  const ry = w.ry(b.riser, a);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    ctx.moveTo(w.rx(b.chute[i], a), w.ry(b.chute[i], a));
    ctx.lineTo(rx, ry);
  }
  ctx.stroke();
  ctx.restore();
}

function drawTether(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  ctx.save();
  ctx.globalAlpha = o.fade;
  ctx.lineWidth = 1.3;
  ctx.lineJoin = 'round';
  // Pale cord, dimmed toward the shadow tone so it reads on bright haze and dark sky alike.
  ctx.strokeStyle = rgb(blend(o.light.shade, [70, 72, 80], 0.45), 0.85);
  ctx.beginPath();
  ctx.moveTo(w.rx(b.neck, a), w.ry(b.neck, a));
  for (let i = 0; i < b.ropeCount; i++) ctx.lineTo(w.rx(b.rope[i], a), w.ry(b.rope[i], a));
  ctx.lineTo(w.rx(b.payloadTop, a), w.ry(b.payloadTop, a));
  ctx.stroke();
  ctx.restore();
}

/** Angle of the tether at rope point `index`, pointing down the line. */
function ropeAngle(b: Balloon, index: number, alpha: number): number {
  const w = b.world;
  const before = b.rope[Math.max(0, index - 1)];
  const after = b.rope[Math.min(b.ropeCount - 1, index + 1)];
  return Math.atan2(w.ry(after, alpha) - w.ry(before, alpha), w.rx(after, alpha) - w.rx(before, alpha)) - Math.PI / 2;
}

/** How much the light falls on an object's +x side, in that object's rotated frame. */
function across(l: SceneLight, angle: number): number {
  return l.x * Math.cos(angle) + l.y * Math.sin(angle);
}

/**
 * The parachute riding the tether below the balloon: a collapsed orange
 * canopy hanging from its apex, gores falling in folds to a ruffled hem, the
 * shroud lines gathering into a swivel that carries the line on down.
 */
function drawBundle(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  if (b.burstAmount >= 1) return;
  const w = b.world;
  const a = o.alpha;
  const l = o.light;
  let riserIndex = 0;
  for (let i = 0; i < b.ropeCount; i++) {
    if (b.rope[i] === b.riser) riserIndex = i;
  }
  const angle = ropeAngle(b, riserIndex, a);
  const side = across(l, angle) >= 0 ? 1 : -1;
  const t = o.reduced ? 0 : o.time;
  const sway = Math.sin(t * 2.7) * 0.8;

  ctx.save();
  ctx.globalAlpha = (1 - b.burstAmount) * o.fade;
  ctx.translate(w.rx(b.riser, a), w.ry(b.riser, a));
  ctx.rotate(angle);
  if (chutePhoto.ready) {
    // A slight swing about the apex, as the hanging canopy lags the line.
    ctx.translate(0, -20);
    ctx.rotate(sway * 0.05);
    chutePhoto.draw(ctx, l, CHUTE.apex, 0, 0);
    ctx.restore();
    return;
  }

  // Canopy: four gores side by side, each a lit or shadowed fold.
  const top = -20;
  const hem = 8;
  const gores = 4;
  const half = 6.5;
  for (let g = 0; g < gores; g++) {
    const x0 = -half + (g / gores) * half * 2;
    const x1 = -half + ((g + 1) / gores) * half * 2;
    // Folds facing the light are lit; the rest fall into half-tone and shadow.
    const facing = ((x0 + x1) / 2 / half) * side;
    const flutter = Math.sin(t * 6 + g * 1.9) * 0.6;
    ctx.fillStyle = rgb(lit(g % 2 ? CHUTE_SHADE : CHUTE_LIT, l, 0.55 + 0.45 * facing));
    ctx.beginPath();
    ctx.moveTo(x0 * 0.35, top + 2);
    ctx.quadraticCurveTo(x0 * 1.15, top + 9, x0 + sway, hem + (g % 2 ? 1.5 : 0) + flutter);
    ctx.lineTo(x1 + sway, hem + (g % 2 ? 0 : 1.5) - flutter);
    ctx.quadraticCurveTo(x1 * 1.15, top + 9, x1 * 0.35, top + 2);
    ctx.closePath();
    ctx.fill();
  }
  // Apex: the rounded crown and its vent band.
  ctx.fillStyle = rgb(lit(CHUTE_LIT, l, 0.85));
  ctx.beginPath();
  ctx.ellipse(0, top + 2.5, 3.2, 2.2, 0, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = rgb(lit(STYRO, l, 0.8));
  ctx.fillRect(-2.2, top - 0.5, 4.4, 1.6);

  // Shroud lines gathering below the hem into the swivel.
  ctx.strokeStyle = rgb(lit([236, 232, 222], l, 0.75), 0.85);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let g = 0; g <= gores; g++) {
    ctx.moveTo(-half + (g / gores) * half * 2 + sway, hem + 0.5);
    ctx.lineTo(0, hem + 12);
  }
  ctx.stroke();
  drawSwivel(ctx, l, 0, hem + 13);
  ctx.restore();
}

/** A barrel swivel: two eyes and a turned brass-grey body. */
function drawSwivel(ctx: CanvasRenderingContext2D, l: SceneLight, x: number, y: number): void {
  const side = l.x >= 0 ? 1 : -1;
  ctx.strokeStyle = rgb(lit(METAL, l, 0.7));
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, 1.4, 0, 6.283);
  ctx.arc(x, y + 6.2, 1.4, 0, 6.283);
  ctx.stroke();
  const body = ctx.createLinearGradient(x - 1.6 * side, 0, x + 1.6 * side, 0);
  body.addColorStop(0, rgb(lit(METAL, l, 0.45)));
  body.addColorStop(1, rgb(lit(METAL, l, 1)));
  ctx.fillStyle = body;
  ctx.fillRect(x - 1.6, y + 1.4, 3.2, 3.4);
}

/** The line unwinder above the sonde: a small styrofoam spool paying out the train. */
function drawUnwinder(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  const l = o.light;
  const index = Math.max(1, b.ropeCount - 3);
  const point = b.rope[index];
  const angle = ropeAngle(b, index, a);
  const side = across(l, angle) >= 0 ? 1 : -1;
  ctx.save();
  ctx.globalAlpha = o.fade;
  ctx.translate(w.rx(point, a), w.ry(point, a));
  ctx.rotate(angle);
  if (unwinderPhoto.ready) {
    unwinderPhoto.draw(ctx, l, UNWINDER.centre, 0, 0);
    ctx.restore();
    return;
  }
  const body = ctx.createLinearGradient(-6 * side, 0, 6 * side, 0);
  body.addColorStop(0, rgb(lit(STYRO, l, 0.45)));
  body.addColorStop(0.55, rgb(lit(STYRO, l, 0.85)));
  body.addColorStop(1, rgb(lit(STYRO, l, 1)));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-6, -5, 12, 10, 2.5);
  ctx.fill();
  // The wound line showing in the spool's waist.
  ctx.fillStyle = rgb(lit([200, 196, 186], l, 0.6));
  ctx.fillRect(-6, -1.3, 12, 2.6);
  ctx.strokeStyle = rgb(blend(l.shade, [40, 46, 58], 0.5), 0.45);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.roundRect(-6, -5, 12, 10, 2.5);
  ctx.stroke();
  ctx.restore();
}

/**
 * The radiosonde, modelled on a modern sonde: a tall white styrofoam body
 * with rounded edges, a printed label, a thin sensor boom rising off the top
 * and a wire antenna trailing below.
 */
function drawPayload(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  const l = o.light;
  const tx = w.rx(b.payloadTop, a);
  const ty = w.ry(b.payloadTop, a);
  const bx = w.rx(b.payloadBottom, a);
  const by = w.ry(b.payloadBottom, a);
  const ang = Math.atan2(by - ty, bx - tx) - Math.PI / 2;
  const side = across(l, ang) >= 0 ? 1 : -1;
  const t = o.reduced ? 0 : o.time;

  ctx.save();
  ctx.globalAlpha = o.fade;
  ctx.translate((tx + bx) / 2, (ty + by) / 2);
  ctx.rotate(ang);

  const swing = Math.sin(t * 2.3) * 1.4;
  if (sondePhoto.ready) {
    // The photographed sonde, with its antenna wire drawn live so it swings.
    const ax = (SONDE.antenna[0] - SONDE.body[0]) / DENSITY;
    const ay = (SONDE.antenna[1] - SONDE.body[1]) / DENSITY;
    ctx.strokeStyle = rgb(lit([86, 90, 96], l, 0.6), 0.85);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(ax + swing * 0.4, ay + 11, ax + 0.5 + swing, ay + 22);
    ctx.stroke();
    sondePhoto.draw(ctx, l, SONDE.body, 0, 0);
    drawLed(ctx, o, 2.6, 9.5, 1);
    ctx.restore();
    return;
  }
  const W = 7.5;
  const H = 13;
  const depth = 4;

  // Antenna: a thin wire hanging from the base, swaying a little.
  ctx.strokeStyle = rgb(lit([86, 90, 96], l, 0.6), 0.85);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-2, H);
  ctx.quadraticCurveTo(-2 + swing * 0.4, H + 12, -1.5 + swing, H + 24);
  ctx.stroke();

  // Sensor boom: a thin arm off the top, bent out to the temperature/humidity tip.
  ctx.strokeStyle = rgb(lit(METAL, l, 0.75));
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-W * 0.4, -H);
  ctx.lineTo(-W * 0.4, -H - 9);
  ctx.lineTo(-W * 0.4 - 6, -H - 15);
  ctx.stroke();
  ctx.fillStyle = rgb(lit(STYRO, l, 0.9));
  ctx.beginPath();
  ctx.ellipse(-W * 0.4 - 6.6, -H - 15.6, 1.4, 1, -0.6, 0, 6.283);
  ctx.fill();

  // Hanger loop where the line ties on.
  ctx.strokeStyle = rgb(lit([236, 232, 222], l, 0.7), 0.9);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-2.5, -H);
  ctx.quadraticCurveTo(0, -H - 5, 2.5, -H);
  ctx.stroke();

  // Body: the side face turned from the light, then the rounded front.
  ctx.fillStyle = rgb(lit(STYRO, l, 0.38));
  ctx.beginPath();
  ctx.moveTo(-side * (W - 1), -H);
  ctx.lineTo(-side * (W + depth), -H + 2);
  ctx.lineTo(-side * (W + depth), H - 1);
  ctx.lineTo(-side * (W - 1), H);
  ctx.closePath();
  ctx.fill();
  const front = ctx.createLinearGradient(side * W, 0, -side * W, 0);
  front.addColorStop(0, rgb(lit(STYRO, l, 1)));
  front.addColorStop(0.65, rgb(lit(STYRO, l, 0.9)));
  front.addColorStop(1, rgb(lit(STYRO, l, 0.68)));
  ctx.fillStyle = front;
  ctx.beginPath();
  ctx.roundRect(-W, -H, W * 2, H * 2, 2.6);
  ctx.fill();
  // Top cap, slightly darker grey plastic.
  ctx.fillStyle = rgb(lit([204, 206, 208], l, 0.8));
  ctx.beginPath();
  ctx.roundRect(-W, -H, W * 2, 4, [2.6, 2.6, 0, 0]);
  ctx.fill();
  // Printed label: a pale panel with a coloured band and a few lines of type.
  ctx.fillStyle = rgb(lit([250, 250, 246], l, 0.95));
  ctx.fillRect(-W + 2, -4, W * 2 - 4, 11);
  ctx.fillStyle = rgb(lit([46, 92, 160], l, 0.9));
  ctx.fillRect(-W + 2, -4, W * 2 - 4, 2.2);
  ctx.fillStyle = rgb(lit([120, 124, 130], l, 0.8), 0.8);
  for (let k = 0; k < 3; k++) ctx.fillRect(-W + 3.2, -0.2 + k * 2.3, (W * 2 - 6.4) * (k === 2 ? 0.55 : 1), 0.8);
  ctx.strokeStyle = rgb(blend(l.shade, [40, 46, 58], 0.5), 0.5);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(-W, -H, W * 2, H * 2, 2.6);
  ctx.stroke();

  drawLed(ctx, o, W - 2.6, H - 3, 1.1);
  ctx.restore();
}

/** The sonde's green status LED, blinking while it transmits. */
function drawLed(ctx: CanvasRenderingContext2D, o: DrawOptions, x: number, y: number, r: number): void {
  const blink = o.reduced ? 0.7 : Math.sin(o.time * 4.2) > 0.35 ? 1 : 0.12;
  ctx.globalAlpha = blink * o.fade;
  ctx.fillStyle = '#56d36a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = blink * 0.3 * o.fade;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.7, 0, 6.283);
  ctx.fill();
}
