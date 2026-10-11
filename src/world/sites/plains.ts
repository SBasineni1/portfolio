import far from '../../assets/sites/plains/far.webp';
import near from '../../assets/sites/plains/near.webp';
import pad from '../../assets/gear/pad-plains.webp';
import type { LaunchSite } from './types';

/** Open plains under a low overcast that the ascent punches through. */
export const plains: LaunchSite = {
  id: 'plains',
  label: 'Open plains',
  layers: [
    { url: far, depthK: 0.7, driftK: 0.015, hazeFrom: 100, hazeTo: 700 },
    { url: near, depthK: 3.2, driftK: 0.06, hazeFrom: 0, hazeTo: 400 },
  ],
  groundRow: 0.75,
  focusX: 0.5,
  sky: {
    ground: {
      top: [112, 122, 134],
      upper: [134, 143, 154],
      mid: [164, 171, 178],
      haze: [192, 195, 196],
      low: [184, 187, 186],
    },
    blendTop: 1700,
    warmth: 0,
    sunX: 0.3,
    sun: 0.08,
    aerial: [172, 177, 182],
  },
  deck: { base: 700, top: 1350, under: [128, 135, 145], over: [246, 247, 248] },
  fx: [
    { kind: 'birds', layer: 0, y: 330, count: 5 },
    { kind: 'grass', layer: 1, top: 560, bottom: 724 },
  ],
  stage: {
    pad,
    centre: [408.9, 133.4],
    squash: 0.5,
    mast: [238, -8],
    receiver: [-188, 2],
    cylinder: [112, 10],
    sock: [-300, -12],
  },
  cloud: { top: '#dcdee0', base: '#a3a8ae' },
};
