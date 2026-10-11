import far from '../../assets/sites/desert/far.webp';
import mid from '../../assets/sites/desert/mid.webp';
import near from '../../assets/sites/desert/near.webp';
import pad from '../../assets/gear/pad-desert.webp';
import type { LaunchSite } from './types';

/** High desert: the approved Reno-inspired panorama, cut into three plates. */
export const desert: LaunchSite = {
  id: 'desert',
  label: 'High desert',
  layers: [
    { url: far, depthK: 0.9, driftK: 0.015, hazeFrom: 100, hazeTo: 700 },
    { url: mid, depthK: 1.8, driftK: 0.035, hazeFrom: 50, hazeTo: 500 },
    { url: near, depthK: 3.2, driftK: 0.06, hazeFrom: 0, hazeTo: 400 },
  ],
  groundRow: 0.75,
  focusX: 0.5,
  sky: {
    ground: {
      top: [38, 105, 174],
      upper: [75, 143, 201],
      mid: [142, 191, 224],
      haze: [236, 232, 220],
      low: [226, 224, 206],
    },
    blendTop: 2500,
    warmth: 0.22,
    sunX: 0.22,
    sun: 1,
    aerial: [196, 206, 216],
  },
  fx: [
    { kind: 'cloud-shadows', layer: 1, groundTop: 404, strength: 0.16 },
    { kind: 'dust-devil', layer: 1, y: 452, color: [222, 196, 156] },
    { kind: 'dust', layer: 2, top: 500, bottom: 724, color: [214, 196, 166] },
  ],
  stage: {
    pad,
    centre: [386.9, 143.2],
    squash: 0.62,
    mast: [-262, -4],
    receiver: [-92, 4],
    cylinder: [158, 2],
    sock: [272, -6],
  },
  cloud: { top: '#efe7dc', base: '#c9b8a4' },
};
