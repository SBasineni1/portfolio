import far from '../../assets/sites/snowfield/far.webp';
import near from '../../assets/sites/snowfield/near.webp';
import pad from '../../assets/gear/pad-snowfield.webp';
import type { LaunchSite } from './types';

/** Snow-dusted upland with an instrument compound and a fog bank in the hills. */
export const snowfield: LaunchSite = {
  id: 'snowfield',
  label: 'Snowfield',
  layers: [
    { url: far, depthK: 1.3, driftK: 0.02, hazeFrom: 100, hazeTo: 700 },
    { url: near, depthK: 3.2, driftK: 0.06, hazeFrom: 0, hazeTo: 400 },
  ],
  groundRow: 0.78,
  focusX: 0.42,
  sky: {
    ground: {
      top: [34, 82, 168],
      upper: [62, 120, 198],
      mid: [128, 172, 220],
      haze: [220, 229, 236],
      low: [212, 221, 228],
    },
    blendTop: 2600,
    warmth: 0.04,
    sunX: 0.2,
    sun: 1,
    aerial: [206, 218, 230],
  },
  fx: [
    { kind: 'fog-bank', layer: 0, y: 372, thickness: 30 },
    { kind: 'cloud-shadows', layer: 0, groundTop: 420, strength: 0.18 },
    { kind: 'spindrift', layer: 1, top: 560, bottom: 724 },
  ],
  stage: {
    pad,
    centre: [381.1, 100.6],
    squash: 0.7,
    mast: [214, -6],
    receiver: [-84, 2],
    cylinder: [-170, 4],
    sock: [318, -10],
  },
  cloud: { top: '#e9eef3', base: '#b9c6d4' },
  weather: { base: 1100, odds: { flurries: 0.3, snow: 0.2 } },
};
