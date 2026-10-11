import far from '../../assets/sites/basecamp/far.webp';
import mid from '../../assets/sites/basecamp/mid.webp';
import near from '../../assets/sites/basecamp/near.webp';
import pad from '../../assets/gear/pad-basecamp.webp';
import type { LaunchSite } from './types';

/** Himalayan base camp on the moraine below a summit trailing its banner cloud. */
export const basecamp: LaunchSite = {
  id: 'basecamp',
  label: 'Base camp',
  layers: [
    { url: far, depthK: 0.8, driftK: 0.01, hazeFrom: 150, hazeTo: 900 },
    { url: mid, depthK: 1.8, driftK: 0.03, hazeFrom: 50, hazeTo: 500 },
    { url: near, depthK: 3.2, driftK: 0.06, hazeFrom: 0, hazeTo: 400 },
  ],
  groundRow: 0.8,
  focusX: 0.6,
  sky: {
    ground: {
      top: [12, 52, 134],
      upper: [26, 82, 164],
      mid: [62, 122, 196],
      haze: [150, 186, 222],
      low: [168, 198, 226],
    },
    blendTop: 3200,
    warmth: 0,
    sunX: 0.16,
    sun: 1,
    aerial: [150, 178, 210],
  },
  fx: [
    { kind: 'summit-plume', layer: 0, x: 1402, y: 50 },
    { kind: 'cloud-shadows', layer: 1, groundTop: 482, strength: 0.14 },
    { kind: 'prayer-flags', layer: 1, from: [1372, 486], to: [1610, 497], sag: 9 },
    { kind: 'spindrift', layer: 2, top: 580, bottom: 724 },
  ],
  stage: {
    pad,
    centre: [417.3, 152.5],
    squash: 0.5,
    mast: [-276, -10],
    receiver: [104, 6],
    cylinder: [-150, 8],
    sock: [262, -14],
  },
  cloud: { top: '#eef2f7', base: '#aebfd2' },
};
