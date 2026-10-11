import far from '../../assets/sites/station/far.webp';
import near from '../../assets/sites/station/near.webp';
import pad from '../../assets/gear/pad-station.webp';
import type { LaunchSite } from './types';

/** A photographed upper-air weather office at golden hour: tower, radome, dish and lawn. */
export const station: LaunchSite = {
  id: 'station',
  label: 'Upper-air station',
  layers: [
    { url: far, depthK: 1.4, driftK: 0.02, hazeFrom: 100, hazeTo: 700 },
    { url: near, depthK: 3.2, driftK: 0.06, hazeFrom: 0, hazeTo: 400 },
  ],
  groundRow: 0.79,
  focusX: 0.7,
  sky: {
    ground: {
      top: [40, 100, 176],
      upper: [76, 138, 202],
      mid: [148, 186, 216],
      haze: [244, 218, 172],
      low: [238, 204, 154],
    },
    blendTop: 2400,
    warmth: 0.75,
    sunX: 0.06,
    sun: 1,
    aerial: [214, 206, 186],
  },
  fx: [
    { kind: 'cloud-shadows', layer: 0, groundTop: 480, strength: 0.12 },
    { kind: 'anemometer', layer: 0, x: 389, y: 132 },
    { kind: 'beacon', layer: 0, x: 437, y: 105, phase: 0 },
    { kind: 'beacon', layer: 0, x: 1642, y: 176, phase: 0.45 },
    { kind: 'birds', layer: 0, y: 300, count: 4 },
  ],
  stage: {
    pad,
    centre: [420.2, 109.8],
    squash: 0.68,
    mast: [-262, -6],
    receiver: [-176, 6],
    cylinder: [124, 4],
    sock: [246, -8],
  },
  cloud: { top: '#f3e3cf', base: '#b8a9ad' },
};

