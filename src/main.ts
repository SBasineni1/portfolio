import './style.css';
import { Balloon, GUST_PEAK, type BalloonEnv } from './physics/balloon';
import { windAt } from './physics/wind';
import { attachInput } from './input';
import { Camera, RELEASE_ALTITUDE, burstAmount } from './world/camera';
import { Scenery, groundScreenY, type View } from './world/scenery';
import { drawBalloon, type DrawOptions } from './world/render';
import { loadSprites } from './world/sprites';
import { Nav } from './ui/nav';
import { Sections } from './ui/sections';
import { AltTape } from './ui/tape';

loadSprites();

const skyElement = document.querySelector<HTMLCanvasElement>('#sky');
if (!skyElement) throw new Error('Sky canvas not found.');
const skyCanvas = skyElement;
const skyCanvasContext = skyCanvas.getContext('2d', { alpha: false });
if (!skyCanvasContext) throw new Error('2D sky canvas context is unavailable.');
const skyContext = skyCanvasContext;

const sceneCanvas = document.querySelector<HTMLCanvasElement>('#scene');
if (!sceneCanvas) throw new Error('Scene canvas not found.');
const canvas = sceneCanvas;
const sceneContext = canvas.getContext('2d', { alpha: true });
if (!sceneContext) throw new Error('2D canvas context is unavailable.');
const context = sceneContext;

/** How many viewports of scroll the whole 35 km ascent takes. */
const VIEWPORTS = 11;
const SIM_STEP = 1 / 120;
const MAX_FRAME = 0.25;
const EXIT_CLEARANCE = 420;

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let reduced = reducedQuery.matches;
reducedQuery.addEventListener('change', (e) => {
  reduced = e.matches;
});

const coarse = window.matchMedia('(pointer: coarse)').matches;
const lowPower = coarse || window.innerWidth < 760 || (navigator.hardwareConcurrency ?? 8) <= 4;
document.body.classList.toggle('low-power', lowPower);

let focus = 0;
let hidden = 0;

let width = window.innerWidth;
let height = window.innerHeight;

const camera = new Camera();
const scenery = new Scenery(lowPower ? 0.55 : 1);
const balloon = new Balloon(width, height, lowPower);
const sections = new Sections(
  () => reduced,
  () => {
    if (!reduced) balloon.gust(GUST_PEAK, 1);
  },
);
const nav = new Nav(() => reduced);
const tape = new AltTape();

let driftX = 0;
let time = 0;
let anchored = true;
let windStrength = 0;
let narrow = window.innerWidth < 900;

const env: BalloonEnv = {
  altitude: 0,
  anchored: true,
  burst: 0,
  windX: 0,
  windY: 0,
  homeX: width * 0.5,
  homeY: height * 0.42,
  padX: width * 0.5,
  padY: 0,
  groundY: 0,
  reduced,
  time: 0,
};

const view: View = {
  width,
  height,
  altitude: 0,
  time: 0,
  driftX: 0,
  windStrength: 0,
  reduced,
};

const drawOptions: DrawOptions = { time: 0, dark: 0, reduced, alpha: 0, fade: 1 };

/**
 * How far the page ink has crossed from daylight to instrument white, 0..1.
 *
 * The sky is a continuous gradient, so the copy that sits on it is too: this
 * is written to `--dark` every frame instead of toggling a threshold class,
 * which means the ink tracks the scroll rather than snapping at one altitude
 * and then crossfading on a timer of its own. The band is deliberately parked
 * in the empty stretch between the About and Projects panels, so no copy is
 * ever caught mid-crossfade at low contrast.
 */
const INK_FROM = 4800;
const INK_TO = 7200;
let inkDark = -1;
let lastFocus = -1;

function syncSignals(altitude: number, nextFocus: number): void {
  const span = (altitude - INK_FROM) / (INK_TO - INK_FROM);
  const t = Math.min(1, Math.max(0, span));
  // Smootherstep, not smoothstep: it lingers at each end and crosses the
  // middle fast. Halfway through, the ink is a mid grey on a mid blue sky,
  // which is the one genuinely weak moment in the ascent — so the less
  // scroll spent there, the better.
  const eased = t * t * t * (t * (t * 6 - 15) + 10);
  // Style writes force a recalc, so only publish visible changes.
  if (Math.abs(eased - inkDark) >= 0.004) {
    inkDark = eased;
    document.documentElement.style.setProperty('--dark', eased.toFixed(3));
    // The panels can afford to blend through the crossover because none of them
    // fly in this band. The fixed chrome does, and a scroll-linked blend would
    // park it at mid grey on a mid blue sky for as long as the reader sits
    // there. So the chrome steps instead, and crosses the weak zone on a timer
    // it controls rather than one the scrollbar controls.
    document.body.classList.toggle('sky-dark', eased > 0.5);
  }
  if (Math.abs(nextFocus - lastFocus) < 0.004) return;
  lastFocus = nextFocus;
  document.documentElement.style.setProperty('--focus', nextFocus.toFixed(3));
}

function resize(): void {
  const oldW = width;
  const oldH = height;
  width = window.innerWidth;
  height = window.innerHeight;

  const dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 2 : 2.5);
  const skyDpr = Math.min(dpr, lowPower ? 1 : 1.5);
  skyCanvas.width = Math.round((width + 48) * skyDpr);
  skyCanvas.height = Math.round((height + 48) * skyDpr);
  skyCanvas.style.width = `${width + 48}px`;
  skyCanvas.style.height = `${height + 48}px`;
  skyContext.setTransform(skyDpr, 0, 0, skyDpr, 24 * skyDpr, 24 * skyDpr);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  scenery.resize(width, height);

  balloon.recenter((width - oldW) * 0.5, (height - oldH) * 0.42);

  narrow = width < 900;
  sections.layout(Math.round(height * VIEWPORTS), height, narrow);
  tape.layout();
  camera.readFromScroll();
}

function update(dt: number): void {
  time += dt;
  camera.step(dt);
  const altitude = camera.altitude;

  const wind = windAt(altitude, time, reduced);
  windStrength = Math.min(1, wind.strength + balloon.gustLevel);
  driftX -= (wind.x + balloon.gustAccelSigned) * dt * 0.11;

  // Release / re-anchor with hysteresis so a jittery scroll can't chatter.
  if (anchored && camera.targetAltitude > RELEASE_ALTITUDE) anchored = false;
  else if (!anchored && camera.targetAltitude < RELEASE_ALTITUDE * 0.45) anchored = true;

  env.altitude = altitude;
  env.anchored = anchored;
  env.burst = burstAmount(altitude);
  env.windX = wind.x;
  env.windY = wind.y;
  env.homeX = width * 0.5 + sections.exit * (reduced ? 0 : 1) * (width * 0.5 + EXIT_CLEARANCE);
  const defaultY = narrow ? 0.17 : anchored ? 0.42 : 0.44;
  env.homeY = height * defaultY;
  env.padX = width * 0.5;
  env.padY = groundScreenY(altitude, height) - 10;
  env.groundY = groundScreenY(altitude, height) - 4;
  env.reduced = reduced;
  env.time = time;

  balloon.update(dt, env);
}

let skyFrame = 0;

function render(alpha: number): void {
  view.width = width;
  view.height = height;
  view.altitude = camera.altitude;
  view.time = time;
  view.driftX = driftX;
  view.windStrength = windStrength;
  view.reduced = reduced;

  if (focus < 0.99 || skyFrame % 3 === 0) scenery.draw(skyContext, view);
  skyFrame++;

  context.clearRect(0, 0, width, height);

  drawOptions.time = time;
  drawOptions.dark = Math.min(1, Math.max(0, (camera.altitude - 9000) / 15000));
  drawOptions.reduced = reduced;
  drawOptions.alpha = alpha;
  drawOptions.fade = reduced ? 1 - hidden : 1;
  drawBalloon(context, balloon, drawOptions);

  scenery.drawForeground(context, view);
}

let previousTime = performance.now() / 1000;
let accumulator = 0;

function frame(timestamp: number): void {
  const currentTime = timestamp / 1000;
  let delta = currentTime - previousTime;
  previousTime = currentTime;
  if (delta > MAX_FRAME) delta = MAX_FRAME;
  accumulator += delta;

  let steps = 0;
  while (accumulator >= SIM_STEP && steps < 12) {
    update(SIM_STEP);
    accumulator -= SIM_STEP;
    steps++;
  }
  if (steps === 12) accumulator = 0;

  render(accumulator / SIM_STEP);

  tape.update(currentTime, camera.altitude);
  nav.update(camera.altitude);
  const balloonClear = reduced ? hidden > 0.97 : balloon.leftmostX > width + 8;
  focus = sections.update(window.scrollY, height, delta, balloonClear);
  hidden += (sections.exit - hidden) * (1 - Math.exp(-delta * 5));
  syncSignals(camera.altitude, focus);

  requestAnimationFrame(frame);
}

window.addEventListener('scroll', () => camera.readFromScroll(), { passive: true });
window.addEventListener('resize', resize);
attachInput(canvas, balloon);
canvas.addEventListener('pointerdown', () => document.body.classList.add('has-grabbed'), {
  once: true,
});

resize();
camera.jumpTo(camera.targetAltitude);
const relayout = (): void => {
  sections.layout(Math.round(height * VIEWPORTS), height, narrow);
  tape.layout();
};
if (document.fonts) document.fonts.ready.then(relayout);
window.addEventListener('load', relayout);
requestAnimationFrame(frame);
