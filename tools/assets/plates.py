"""Cut a launch-site panorama into parallax depth plates.

Every plate keeps the master's full canvas so all plates of a site share one
coordinate system and one ground row. A plate is opaque from its top edge to
the bottom: the part hidden behind nearer plates is filled with progressively
larger copies of a band of the plate's own terrain, which is roughly what that
ground looks like once the camera climbs and foreshortening relaxes.

Masters are generated on a flat #FF00FF sky and keyed here.

Usage:
  python3 -I tools/assets/plates.py desert <out_dir>
  python3 -I tools/assets/plates.py site <name> <master.png> <out_dir>
  python3 -I tools/assets/plates.py key <master.png> <out.png>

A plate spec (see site_plates) is {"name", "top", "feather", "fill"}:
  top   the edge above which the plate is transparent: a row, a [[x, y], ...]
        polyline, or per-column rows. Omitted means the keyed alpha (skyline).
  fill  the band that is repeated below the next plate's top edge; see tile_fill.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
WEBP_QUALITY = 84


def key_magenta(path: Path) -> np.ndarray:
    """Soft chroma key against #FF00FF with despill; returns float RGBA 0..1."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32) / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # Magenta-ness: red and blue both high, green suppressed.
    spill = np.clip(np.minimum(r, b) - g, 0, 1)
    alpha = 1 - np.clip((spill - 0.22) / 0.38, 0, 1)
    # Unmix the magenta from antialiased edges: observed = a*fg + (1-a)*M.
    magenta = np.array([1, 0, 1], np.float32)
    safe = np.maximum(alpha, 0.05)[..., None]
    unmixed = (rgb - (1 - alpha)[..., None] * magenta) / safe
    rgb = np.where((alpha < 1)[..., None], np.clip(unmixed, 0, 1), rgb)
    # Opaque pixels within 2px of the key still carry a faint magenta cast.
    near = alpha < 0.98
    for _ in range(2):
        grown = near.copy()
        grown[1:] |= near[:-1]
        grown[:-1] |= near[1:]
        grown[:, 1:] |= near[:, :-1]
        grown[:, :-1] |= near[:, 1:]
        near = grown
    cast = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, 1) * near
    rgb[..., 0] -= cast
    rgb[..., 2] -= cast
    return np.dstack([np.clip(rgb, 0, 1), alpha])


def tile_fill(img: np.ndarray, fill: dict, start: np.ndarray) -> np.ndarray:
    """Replace each column from start[x] down with copies of a source band.

    Copies stack downward, each 1.25x larger than the last (ground nearer the
    camera reads bigger), crossfading where they overlap.
    fill: {"rows": [y0, y1], "cols": [x0, x1] (optional, tiled across),
           "patches": [[x0, x1, src], ...] (optional column swaps that keep
           props such as sheds out of the repeated band)}
    """
    h, w = img.shape[:2]
    y0, y1 = fill['rows']
    source = img[y0:y1].copy()
    for x0, x1, src in fill.get('patches', ()):
        source[:, x0:x1] = img[y0:y1, src:src + x1 - x0]
    if 'cols' in fill:
        x0, x1 = fill['cols']
        strip = np.concatenate([source[:, x0:x1], source[:, x0:x1][:, ::-1]], axis=1)
        source = np.tile(strip, (1, w // strip.shape[1] + 1, 1))[:, :w]
    band = Image.fromarray((source * 255).astype(np.uint8), 'RGBA')
    top = int(start.min())
    tiled = np.zeros((h - top, w, 4), np.float32)
    # Each copy backs up over a third of the previous one and fades in across
    # it; copies shift sideways so neighbours never repeat, and deeper (nearer)
    # copies soften slightly.
    pixels_band = np.asarray(band)
    y, scale, k = 0, 1.0, 0
    while y < h - top:
        shift = (k * 641) % w
        rolled = Image.fromarray(np.concatenate([pixels_band[:, shift:], pixels_band[:, :shift]], axis=1), 'RGBA')
        crop_w = int(w / scale)
        left = (w - crop_w) // 2
        tile = rolled.crop((left, 0, left + crop_w, band.height))
        tile = tile.resize((w, max(3, round(band.height * scale))), Image.Resampling.LANCZOS)
        if k:
            tile = tile.filter(ImageFilter.GaussianBlur(min(2.5, 0.5 * k)))
        pixels = np.asarray(tile).astype(np.float32) / 255
        overlap = pixels.shape[0] // 3 if k else 0
        y = max(0, y - overlap)
        rows = min(pixels.shape[0], h - top - y)
        ramp = np.ones(rows, np.float32)
        ramp[:min(rows, overlap)] = np.linspace(0, 1, overlap, endpoint=False)[:rows]
        ramp = ramp[:, None, None]
        tiled[y:y + rows] = tiled[y:y + rows] * (1 - ramp) + pixels[:rows] * ramp
        y += rows
        scale *= 1.25
        k += 1
    tiled[..., 3] = 1
    out = img.copy()
    below = np.arange(top, h)[:, None] >= start[None, :]
    out[top:] = np.where(below[..., None], tiled, out[top:])
    return out


def edge_rows(w: int, top) -> np.ndarray:
    """A top edge as one row per column: a row, a per-column array, or a [[x, y], ...] polyline."""
    if np.isscalar(top):
        return np.full(w, float(top), np.float32)
    top = np.asarray(top, np.float32)
    if top.ndim == 2:
        return np.interp(np.arange(w), top[:, 0], top[:, 1]).astype(np.float32)
    return top


def top_mask(h: int, w: int, top, feather: int) -> np.ndarray:
    rows = np.arange(h, dtype=np.float32)[:, None]
    return np.clip((rows - edge_rows(w, top)[None, :]) / max(1, feather) + 0.5, 0, 1)


def save(img: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    out = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    out.save(path, 'WEBP', quality=WEBP_QUALITY, method=6, alpha_quality=90)
    print(f'{path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}: '
          f'{out.size[0]}x{out.size[1]} {path.stat().st_size // 1024} KB')


def cut(img: np.ndarray, plates: list, out_dir: Path) -> None:
    """Each plate's fill begins where the next (nearer) plate's top edge does."""
    h, w = img.shape[:2]
    for i, spec in enumerate(plates):
        plate = img.copy()
        if 'fill' in spec:
            start = edge_rows(w, plates[i + 1]['top'])
            plate = tile_fill(plate, spec['fill'], np.ceil(start).astype(int))
        top = spec.get('top', 'alpha')
        if not isinstance(top, str):
            plate[..., 3] *= top_mask(h, w, top, spec.get('feather', 3))
        save(plate, out_dir / f"{spec['name']}.webp")


def desert_skyline() -> np.ndarray:
    """The skyline measured off the desert painting (its sky is a baked checkerboard)."""
    rows = json.loads((Path(__file__).with_name('desert-skyline.json')).read_text())
    return np.array(rows, np.float32)


# The shed and the fence brace, swapped for neighbouring scrub in fill bands.
SHED = [[245, 370, 380], [1520, 1630, 1660]]


def desert(out_dir: Path) -> None:
    rgb = np.asarray(Image.open(Path(__file__).with_name('masters') / 'desert.png').convert('RGB'))
    img = np.dstack([rgb.astype(np.float32) / 255, np.ones(rgb.shape[:2], np.float32)])
    # One-pixel inset, as the old clip did, so the baked checkerboard never shows.
    img[..., 3] = top_mask(*img.shape[:2], desert_skyline() + 1, 2)
    cut(img, [
        {'name': 'far', 'fill': {'rows': [410, 468], 'patches': SHED}},
        {'name': 'mid', 'top': 402, 'feather': 4, 'fill': {'rows': [428, 468], 'patches': SHED}},
        {'name': 'near', 'top': 478, 'feather': 2},
    ], out_dir)


def site_plates(site: str) -> list:
    # The photographic station shares the painted one's layout, so it shares its cuts.
    if site in ('station', 'station-real'):
        return [
            {'name': 'far', 'fill': {'rows': [506, 524], 'cols': [600, 1500]}},
            # The apron's curved front edge against the lawn.
            {'name': 'near', 'feather': 3, 'top': [[0, 568], [200, 556], [400, 545], [600, 537], [800, 532],
                                                  [1086, 530], [1400, 532], [1600, 536], [1800, 543],
                                                  [1950, 550], [2172, 566]]},
        ]
    if site == 'snowfield':
        return [
            {'name': 'far', 'fill': {'rows': [452, 504], 'patches': [[150, 470, 640]]}},
            {'name': 'near', 'feather': 6, 'top': [[0, 522], [400, 516], [900, 513], [1400, 516],
                                                  [1600, 532], [1800, 556], [2172, 562]]},
        ]
    if site == 'basecamp':
        return [
            {'name': 'far', 'fill': {'rows': [522, 556], 'cols': [520, 1500]}},
            # Below the ice seracs on the left, above the tents on the right.
            {'name': 'mid', 'feather': 4, 'fill': {'rows': [522, 556], 'cols': [520, 1500]},
             'top': [[0, 504], [930, 510], [1060, 492], [1240, 482], [2172, 482]]},
            # Rounds the big left boulder so its crown stays on the near plate.
            {'name': 'near', 'feather': 4, 'top': [[0, 530], [60, 518], [120, 516], [200, 522], [250, 540],
                                                  [290, 560], [1640, 562], [1700, 548], [1860, 546],
                                                  [1900, 562], [2172, 562]]},
        ]
    # Photographic masters (the shipped look): same scenes, re-measured cut lines.
    if site == 'desert-real':
        return [
            {'name': 'far', 'fill': {'rows': [410, 466], 'patches': SHED}},
            {'name': 'mid', 'top': 402, 'feather': 4, 'fill': {'rows': [430, 466], 'patches': SHED}},
            {'name': 'near', 'top': 498, 'feather': 3},
        ]
    if site == 'snowfield-real':
        return [
            {'name': 'far', 'fill': {'rows': [452, 500], 'patches': [[150, 470, 640]]}},
            {'name': 'near', 'feather': 6, 'top': [[0, 510], [1100, 509], [2172, 512]]},
        ]
    if site == 'basecamp-real':
        return [
            {'name': 'far', 'fill': {'rows': [522, 552], 'cols': [520, 1300]}},
            # Below the seracs on the left, above the tents on the right.
            {'name': 'mid', 'feather': 4, 'fill': {'rows': [522, 552], 'cols': [520, 1300]},
             'top': [[0, 500], [720, 500], [900, 482], [1300, 476], [2172, 476]]},
            # Lifts on the left so the big boulders stay whole on the near plate.
            {'name': 'near', 'feather': 4, 'top': [[0, 508], [250, 508], [320, 535], [2172, 535]]},
        ]
    if site in ('plains', 'plains-real'):
        return [
            {'name': 'far', 'fill': {'rows': [432, 470]}},
            {'name': 'near', 'top': 476, 'feather': 10},
        ]
    raise SystemExit(f'unknown site {site}')


def site(name: str, master: Path, out_dir: Path) -> None:
    img = key_magenta(master)
    cut(img, site_plates(name), out_dir)


def main(argv: list) -> None:
    command = argv[1] if len(argv) > 1 else ''
    if command == 'key':
        save(key_magenta(Path(argv[2])), Path(argv[3]))
    elif command == 'desert':
        desert(Path(argv[2]))
    elif command == 'site':
        site(argv[2], Path(argv[3]), Path(argv[4]))
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv)
