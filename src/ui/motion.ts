import { gsap } from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

/**
 * GSAP in one place. Timing for every page reveal lives here, so the motion
 * vocabulary stays consistent: things arrive by rising out of a mask (type)
 * or settling up a few pixels (objects), with one ease family.
 */
export { gsap, SplitText };

export const EASE_OUT = 'expo.out';
export const EASE_SETTLE = 'power3.out';
