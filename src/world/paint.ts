/**
 * Shared paint for objects that sit in the scene (the flight train and the
 * pad gear): one scene light, written by Scenery each frame, and helpers that
 * shade a flat material colour by it, so everything placed on a site is lit
 * by that site's sun and sky.
 */

export type Rgb = [number, number, number];

/** The scene's light as an object at a given point sees it. */
export interface SceneLight {
  /** Unit vector toward the light, screen space. */
  x: number;
  y: number;
  /** Lit latex, shadowed latex and the sky's bounce on the shadow side. */
  key: Rgb;
  shade: Rgb;
  rim: Rgb;
  /** Direct-sun strength: 0 under overcast, 1 in clear sun. Drives highlights and cast shadows. */
  gloss: number;
  /** The site's ground colour, measured from its photograph: light bounced up off it. */
  ground: Rgb;
  /** The site's ground-shadow colour, for contact and cast shadows. */
  shadow: Rgb;
  /** How close to the ground the lit object is: 1 on the pad, 0 a few hundred metres up. */
  bounce: number;
}

export function sceneLight(): SceneLight {
  return {
    x: -0.6,
    y: -0.8,
    key: [247, 244, 237],
    shade: [180, 186, 196],
    rim: [220, 232, 244],
    gloss: 1,
    ground: [150, 142, 128],
    shadow: [44, 42, 40],
    bounce: 1,
  };
}

/** Relative luminance on the 0..255 scale. */
export function luma(c: Rgb): number {
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}

export function rgb(c: Rgb, alpha = 1): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;
}

export function blend(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * A material colour under the scene light: 1 is the face turned to the sun,
 * 0 the face turned away (lit only by the sky), anything between a half-tone.
 */
export function lit(base: Rgb, l: SceneLight, amount: number): Rgb {
  const sky = blend(l.shade, l.key, 0.5);
  const shadow: Rgb = [base[0] * (sky[0] / 255) * 0.8, base[1] * (sky[1] / 255) * 0.8, base[2] * (sky[2] / 255) * 0.84];
  const light: Rgb = [base[0] * (l.key[0] / 247), base[1] * (l.key[1] / 244), base[2] * (l.key[2] / 237)];
  return blend(shadow, light, amount);
}
