"""Key, edit and scale the launch-gear photographs into sprites.

Each source is a photo of one object on a flat #FF00FF background
(tools/assets/masters/gear/). Parts that move live in code, not in the photo:
the windsock mast loses its empty hoop arm (the sock carries its own hoop),
the receiver loses its antenna whip (drawn as a springy rod instead) and the
sonde loses its antenna wire (drawn swinging).

Usage: python3 -I tools/assets/gear.py
Prints each sprite's size and anchors, in sprite pixels, for src/world/pad.ts.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from plates import ROOT, key_magenta  # noqa: E402

SOURCE = Path(__file__).with_name('masters') / 'gear'
OUT = ROOT / 'src/assets/gear'

# name: (target height or width in sprite px, 'h' or 'w', erase boxes [x0, y0, x1, y1] in source px,
#        anchors in source px)
SPECS = {
    'windsock-mast': (300, 'h', [[160, 0, 526, 140]], {'base': [136, 1935], 'swivel': [150, 80]}),
    'windsock-cloth': (220, 'w', [], {'mouth': [120, 352], 'tail': [2127, 368]}),
    'helium': (200, 'h', [], {'base': [406, 2059], 'valve': [406, 71]}),
    'met-mast': (276, 'h', [], {'base': [372, 2071], 'vane': [148, 80], 'cups': [610, 108]}),
    'receiver': (252, 'w', [[1224, 0, 1254, 382]], {'base': [700, 923], 'whip': [1239, 382], 'tip': [1239, 21]}),
    # The flight train. The sonde's antenna wire is drawn live so it can swing.
    'sonde': (130, 'h', [[0, 1480, 724, 2172]], {'body': [341, 1030], 'antenna': [358, 1474]}),
    'chute': (141, 'h', [], {'apex': [365, 36], 'swivel': [352, 2079]}),
    'unwinder': (42, 'h', [], {'centre': [626, 600]}),
    # Staging pads, one per site; anchored at the centroid of their footprint.
    'pad-desert': (780, 'w', [], {'centre': 'centroid'}),
    'pad-plains': (820, 'w', [], {'centre': 'centroid'}),
    'pad-snowfield': (760, 'w', [], {'centre': 'centroid'}),
    'pad-basecamp': (840, 'w', [], {'centre': 'centroid'}),
    'pad-station': (840, 'w', [], {'centre': 'centroid'}),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta = {}
    for name, (size, axis, erase, anchors) in SPECS.items():
        img = key_magenta(SOURCE / f'{name}.png')
        for x0, y0, x1, y1 in erase:
            img[y0:y1, x0:x1, 3] = 0
        ys, xs = np.where(img[..., 3] > 0.02)
        left, top = max(0, xs.min() - 4), max(0, ys.min() - 4)
        right, bottom = min(img.shape[1], xs.max() + 5), min(img.shape[0], ys.max() + 5)
        crop = img[top:bottom, left:right]
        if anchors.get('centre') == 'centroid':
            weights = img[..., 3]
            total = weights.sum()
            anchors = {'centre': [float((weights * np.arange(img.shape[1])[None, :]).sum() / total),
                                  float((weights * np.arange(img.shape[0])[:, None]).sum() / total)]}
        scale = size / (crop.shape[0] if axis == 'h' else crop.shape[1])
        out = Image.fromarray((np.clip(crop, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
        out = out.resize((round(out.width * scale), round(out.height * scale)), Image.Resampling.LANCZOS)
        out.save(OUT / f'{name}.webp', 'WEBP', quality=88, method=6, alpha_quality=95)
        meta[name] = {
            'size': [out.width, out.height],
            **{k: [round((x - left) * scale, 1), round((y - top) * scale, 1)] for k, (x, y) in anchors.items()},
        }
        print(f'{name}: {out.width}x{out.height} {(OUT / f"{name}.webp").stat().st_size // 1024} KB')
    print(json.dumps(meta, indent=1))


if __name__ == '__main__':
    main()
