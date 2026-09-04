import type { Balloon } from '../physics/balloon';
import { bundleSprite, envelopeSprite, sondeSprite } from './sprites';

/**
 * Canvas rendering for the flight article. Kept apart from the simulation so
 * balloon.ts stays pure physics.
 */

export interface DrawOptions {
  time: number;
  /** 0 at the pad, 1 in near-space; cools the latex and lightens the tether. */
  dark: number;
  reduced: boolean;
  alpha: number;
  fade: number;
}

let spriteMix = 0;
let spriteTime = 0;

function mix(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

export function drawBalloon(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  if (o.fade <= 0.005) return;
  const w = b.world;
  const a = o.alpha;
  const inflated = 1 - b.burstAmount;
  const spriteDelta = Math.min(0.25, Math.max(0, o.time - spriteTime));
  spriteTime = o.time;
  if (envelopeSprite.ready) spriteMix = Math.min(1, spriteMix + spriteDelta * 3);

  drawTether(ctx, b, o);
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
  const proceduralMix = envelopeSprite.ready ? 1 - spriteMix : 1;
  if (proceduralMix > 0) drawProceduralEnvelope(ctx, b, o, inflated, proceduralMix);
  if (envelopeSprite.ready && spriteMix > 0) drawSpriteEnvelope(ctx, b, o, inflated, spriteMix);
}

function drawProceduralEnvelope(
  ctx: CanvasRenderingContext2D,
  b: Balloon,
  o: DrawOptions,
  inflated: number,
  opacity: number,
): void {
  const w = b.world;
  const a = o.alpha;

  ctx.save();
  ctx.globalAlpha = Math.min(1, inflated * 1.6) * opacity * o.fade;
  traceRing(ctx, b, a);

  const cx = b.centroidX;
  const cy = b.centroidY;
  const r = Math.max(24, Math.hypot(w.px[b.ring[0]] - cx, w.py[b.ring[0]] - cy) * 1.5);
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r);
  // Latex only cools part-way with the sky; it should still read as pale rubber.
  const d = o.dark * 0.5;
  g.addColorStop(0, `rgb(${mix(255, 236, d)},${mix(251, 240, d)},${mix(240, 248, d)})`);
  g.addColorStop(0.55, `rgb(${mix(243, 214, d)},${mix(235, 220, d)},${mix(219, 232, d)})`);
  g.addColorStop(1, `rgb(${mix(206, 150, d)},${mix(194, 160, d)},${mix(174, 186, d)})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = `rgba(${mix(150, 110, d)},${mix(140, 120, d)},${mix(122, 150, d)},0.75)`;
  ctx.stroke();

  // Specular sheen, clipped to the envelope so it never bleeds onto the sky.
  ctx.clip();
  ctx.globalAlpha = 0.5 * inflated * o.fade;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.26, cy - r * 0.32, r * 0.17, r * 0.28, -0.5, 0, 6.283);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
  ctx.restore();

  // Neck.
  const nx = w.rx(b.neck, a);
  const ny = w.ry(b.neck, a);
  const dx = nx - cx;
  const dy = ny - cy;
  const dl = Math.hypot(dx, dy) || 1;
  const ux = dx / dl;
  const uy = dy / dl;
  ctx.save();
  ctx.translate(nx, ny);
  ctx.rotate(Math.atan2(uy, ux) - Math.PI / 2);
  ctx.globalAlpha = inflated * o.fade;
  ctx.fillStyle = `rgb(${mix(224, 190, d)},${mix(216, 196, d)},${mix(198, 208, d)})`;
  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.lineTo(9, -4);
  ctx.lineTo(5, 16);
  ctx.lineTo(-5, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(226,102,44,0.9)';
  ctx.fillRect(-6, 10, 12, 3.5);
  ctx.restore();
}

function drawSpriteEnvelope(
  ctx: CanvasRenderingContext2D,
  b: Balloon,
  o: DrawOptions,
  inflated: number,
  opacity: number,
): void {
  const w = b.world;
  const a = o.alpha;
  const n = b.ringCount;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += w.rx(b.ring[i], a);
    cy += w.ry(b.ring[i], a);
  }
  cx /= n;
  cy /= n;

  const nx = w.rx(b.neck, a);
  const ny = w.ry(b.neck, a);
  // The sprite points down at rest, as does the centroid-to-neck vector.
  const phi = Math.atan2(ny - cy, nx - cx) - Math.PI / 2;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = w.rx(b.ring[i], a);
    const y = w.ry(b.ring[i], a);
    const dx = x - cx;
    const dy = y - cy;
    const frameX = dx * cosPhi + dy * sinPhi;
    const frameY = -dx * sinPhi + dy * cosPhi;
    sxx += frameX * frameX;
    syy += frameY * frameY;
    sxy += frameX * frameY;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const varianceX = sxx / n;
  const varianceY = syy / n;
  const r2 = b.envelopeR * b.envelopeR;
  const rawScaleX = Math.sqrt(varianceX / (b.restVarX * r2));
  const rawScaleY = Math.sqrt(varianceY / (b.restVarY * r2));
  const scaleX = Math.min(1.6, Math.max(0.6, rawScaleX));
  const scaleY = Math.min(1.6, Math.max(0.6, rawScaleY));
  const shear = Math.min(0.6, Math.max(-0.6, sxy / n / varianceY));
  const imageScale = (b.envelopeR * 1.06) / envelopeSprite.rx;
  const sw = envelopeSprite.image.naturalWidth * imageScale;
  const sh = envelopeSprite.image.naturalHeight * imageScale;
  const ax = envelopeSprite.cx * imageScale;
  const ay = envelopeSprite.cy * imageScale;

  ctx.save();
  ctx.globalAlpha = Math.min(1, inflated * 1.6) * opacity * o.fade;
  traceRing(ctx, b, a);
  ctx.clip();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(phi);
  ctx.transform(scaleX, 0, shear, scaleY, 0, 0);
  ctx.drawImage(envelopeSprite.image, -ax, -ay, sw, sh);
  ctx.restore();

  if (o.dark > 0.01) {
    const d = o.dark * 0.5;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${mix(255, 200, d)},${mix(255, 208, d)},${mix(255, 232, d)})`;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function drawShreds(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  const fade = b.shredFade;
  if (fade <= 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < b.ringCount; i++) {
    const p = b.ring[i];
    const x = w.rx(p, a);
    const y = w.ry(p, a);
    const vx = w.velX(p);
    const vy = w.velY(p);
    const ang = Math.atan2(vy, vx);
    const len = 12 + (i % 5) * 5;
    ctx.globalAlpha = fade * 0.9 * o.fade;
    ctx.strokeStyle = `rgba(${mix(240, 214, o.dark)},${mix(234, 220, o.dark)},${mix(219, 232, o.dark)},1)`;
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
  ctx.bezierCurveTo(
    lx + nx * dome,
    ly + ny * dome,
    fx + nx * dome,
    fy + ny * dome,
    fx,
    fy,
  );
  ctx.closePath();

  const g = ctx.createLinearGradient(
    fx + nx * dome * 0.6,
    fy + ny * dome * 0.6,
    (fx + lx) / 2,
    (fy + ly) / 2,
  );
  g.addColorStop(0, '#f4a052');
  g.addColorStop(0.55, '#e2662c');
  g.addColorStop(1, '#bf4a20');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(122,48,20,0.65)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Panel seams.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,62,26,0.45)';
  ctx.lineWidth = 1;
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
  ctx.strokeStyle = 'rgba(238,232,220,0.8)';
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
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${mix(48, 214, o.dark)},${mix(52, 220, o.dark)},${mix(58, 232, o.dark)},0.8)`;
  ctx.beginPath();
  ctx.moveTo(w.rx(b.neck, a), w.ry(b.neck, a));
  for (let i = 0; i < b.ropeCount; i++) ctx.lineTo(w.rx(b.rope[i], a), w.ry(b.rope[i], a));
  ctx.lineTo(w.rx(b.payloadTop, a), w.ry(b.payloadTop, a));
  ctx.stroke();
  ctx.restore();
}

function drawBundle(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  if (!bundleSprite.ready || b.burstAmount >= 1) return;
  const w = b.world;
  const a = o.alpha;
  let riserIndex = 0;
  for (let i = 0; i < b.ropeCount; i++) {
    if (b.rope[i] === b.riser) riserIndex = i;
  }
  const before = b.rope[Math.max(0, riserIndex - 1)];
  const after = b.rope[Math.min(b.ropeCount - 1, riserIndex + 1)];
  const angle = Math.atan2(w.ry(after, a) - w.ry(before, a), w.rx(after, a) - w.rx(before, a)) - Math.PI / 2;
  const scale = 44 / bundleSprite.image.naturalHeight;

  ctx.save();
  ctx.globalAlpha = (1 - b.burstAmount) * o.fade;
  ctx.translate(w.rx(b.riser, a), w.ry(b.riser, a));
  ctx.rotate(angle);
  ctx.drawImage(
    bundleSprite.image,
    -bundleSprite.cx * scale,
    -bundleSprite.cy * scale,
    bundleSprite.image.naturalWidth * scale,
    bundleSprite.image.naturalHeight * scale,
  );
  ctx.restore();
}

function drawPayload(ctx: CanvasRenderingContext2D, b: Balloon, o: DrawOptions): void {
  const w = b.world;
  const a = o.alpha;
  const tx = w.rx(b.payloadTop, a);
  const ty = w.ry(b.payloadTop, a);
  const bx = w.rx(b.payloadBottom, a);
  const by = w.ry(b.payloadBottom, a);
  const ang = Math.atan2(by - ty, bx - tx) - Math.PI / 2;

  ctx.save();
  ctx.globalAlpha = o.fade;
  ctx.translate((tx + bx) / 2, (ty + by) / 2);
  ctx.rotate(ang);

  if (sondeSprite.ready) {
    const scale = 46 / sondeSprite.image.naturalHeight;
    ctx.drawImage(
      sondeSprite.image,
      -sondeSprite.cx * scale,
      -sondeSprite.cy * scale,
      sondeSprite.image.naturalWidth * scale,
      sondeSprite.image.naturalHeight * scale,
    );
  } else {
    // Antenna wire below.
    ctx.strokeStyle = `rgba(${mix(60, 200, o.dark)},${mix(64, 206, o.dark)},${mix(70, 216, o.dark)},0.85)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(2, 40);
    ctx.stroke();
    ctx.fillStyle = '#2f343a';
    ctx.beginPath();
    ctx.arc(2, 41, 2.2, 0, 6.283);
    ctx.fill();

    // Sensor boom.
    ctx.strokeStyle = '#9aa1a9';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-16, -4);
    ctx.lineTo(-30, -14);
    ctx.moveTo(-30, -14);
    ctx.lineTo(-34, -11);
    ctx.stroke();

    // Body.
    ctx.fillStyle = '#efe9dc';
    ctx.strokeStyle = 'rgba(58,62,68,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-17, -13, 34, 26, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#d7d0c2';
    ctx.fillRect(-17, -13, 34, 5);
    ctx.fillStyle = 'rgba(226,102,44,0.9)';
    ctx.fillRect(-17, 6, 34, 3);
    ctx.fillStyle = 'rgba(48,52,58,0.75)';
    ctx.fillRect(-12, -4, 14, 6);
  }

  // Status LED.
  const blink = o.reduced ? 0.7 : Math.sin(o.time * 4.2) > 0.35 ? 1 : 0.12;
  ctx.globalAlpha = blink * o.fade;
  ctx.fillStyle = '#f0a21c';
  ctx.beginPath();
  ctx.arc(sondeSprite.ready ? 6 : 9, sondeSprite.ready ? 8 : -1, sondeSprite.ready ? 1.8 : 2.6, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = blink * 0.35 * o.fade;
  ctx.beginPath();
  ctx.arc(sondeSprite.ready ? 6 : 9, sondeSprite.ready ? 8 : -1, sondeSprite.ready ? 4.5 : 6, 0, 6.283);
  ctx.fill();
  ctx.restore();
}
