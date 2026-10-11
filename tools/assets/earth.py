"""Render the Earth seen from near space as one static, high-resolution image.

Sources (public domain, NASA Visible Earth), not committed:
  Blue Marble Next Generation, July 2004, topography + bathymetry, 21600x10800
    https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74092/world.topo.bathy.200407.3x21600x10800.jpg
  Blue Marble clouds, 8192x4096
    https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif

The camera hangs above the central United States looking north-east, high
enough that the horizon is a clear arc. Rays are cast per output pixel with
2x2 supersampling and bilinear texture samples; surface and clouds are lit
from the upper left in linear light, hazed with path length toward the limb,
and ringed by a soft atmosphere glow above the horizon (in the alpha).

Usage:
  python3 -I tools/assets/earth.py <blue-marble.jpg> <clouds.tif> <out_dir>
Writes earth-limb.webp (3840 wide) and earth-limb-1920.webp.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

WIDTH, HEIGHT = 3840, 1120
SS = 2
# Camera height above the surface, in Earth radii (exaggerated for curvature).
H = 0.22
# Vertical half field of view (tangent); horizon centre lands at this fraction of the height.
TAN_V = 0.36
HORIZON_AT = 0.2
VIEW_LAT, VIEW_LON, VIEW_AZIMUTH = 37.0, -96.0, 38.0
SUN = np.array([-0.55, 0.62, -0.56])
ATMOSPHERE = 0.022
SKY_BLUE = np.array([0.32, 0.55, 0.95])
GLOW = np.array([0.62, 0.8, 1.0])


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def bilinear(tex: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Sample an equirectangular texture (u wraps, v clamps) at fractional texel coords."""
    h, w = tex.shape[:2]
    x = u * w - 0.5
    y = np.clip(v * h - 0.5, 0, h - 1.001)
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    x0 %= w
    x1 = (x0 + 1) % w
    y1 = np.minimum(y0 + 1, h - 1)
    t = tex if tex.ndim == 3 else tex[..., None]
    out = (t[y0, x0] * (1 - fx) * (1 - fy) + t[y0, x1] * fx * (1 - fy)
           + t[y1, x0] * (1 - fx) * fy + t[y1, x1] * fx * fy)
    return out


def frame():
    lat, lon, az = np.radians([VIEW_LAT, VIEW_LON, VIEW_AZIMUTH])
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    ahead = np.cos(az) * north + np.sin(az) * east
    right = np.cross(ahead, up)
    return up, ahead, right


def render(bm: np.ndarray, clouds: np.ndarray) -> np.ndarray:
    up, ahead, right = frame()
    sun = SUN / np.linalg.norm(SUN)
    # Camera frame: x right, y up, z back (toward viewer); sun given in that frame.
    sun_world = sun[0] * right + sun[1] * up - sun[2] * ahead
    dip = np.arccos(1 / (1 + H))
    sy0 = 1 - 2 * HORIZON_AT
    pitch = dip + np.arctan(sy0 * TAN_V)
    forward = np.cos(pitch) * ahead - np.sin(pitch) * up
    cam_up = np.sin(pitch) * ahead + np.cos(pitch) * up
    origin = up * (1 + H)
    tan_h = TAN_V * WIDTH / HEIGHT
    out = np.zeros((HEIGHT, WIDTH, 4), np.float32)
    rows_per_chunk = 40
    for r0 in range(0, HEIGHT, rows_per_chunk):
        r1 = min(HEIGHT, r0 + rows_per_chunk)
        acc = np.zeros((r1 - r0, WIDTH, 4), np.float32)
        for sy_i in range(SS):
            for sx_i in range(SS):
                jj = np.arange(r0, r1)[:, None] + (sy_i + 0.5) / SS
                ii = np.arange(WIDTH)[None, :] + (sx_i + 0.5) / SS
                sy = 1 - 2 * jj / HEIGHT
                sx = (2 * ii / WIDTH - 1) * tan_h
                d = (forward[None, None, :] + sx[..., None] * right[None, None, :]
                     + (sy * TAN_V)[..., None] * cam_up[None, None, :])
                d = d / np.linalg.norm(d, axis=-1, keepdims=True)
                b = d @ origin
                c = origin @ origin - 1
                disc = b * b - c
                hit = (disc >= 0) & (b < 0)
                t = np.where(hit, -b - np.sqrt(np.maximum(disc, 0)), 0)
                p = origin[None, None, :] + t[..., None] * d
                n = p / np.maximum(np.linalg.norm(p, axis=-1, keepdims=True), 1e-9)
                lat = np.arcsin(np.clip(n[..., 2], -1, 1))
                lon = np.arctan2(n[..., 1], n[..., 0])
                u = (lon / (2 * np.pi) + 0.5) % 1
                v = 0.5 - lat / np.pi
                surface = srgb_to_linear(bilinear(bm, u, v) / 255)
                cloud = (bilinear(clouds, u, v)[..., 0] / 255) ** 1.1
                lambert = np.clip(n @ sun_world, 0, 1)[..., None]
                ground = surface * (0.05 + 1.15 * lambert)
                cloud_lit = (0.08 + 1.0 * lambert) * np.array([0.98, 0.98, 1.0])
                colour = ground * (1 - cloud[..., None] * 0.9) + cloud_lit * cloud[..., None] * 0.9
                # Aerial perspective: more air toward the limb.
                grazing = 1 - np.clip(-(d * n).sum(-1), 0, 1)
                haze = (1 - np.exp(-t * 1.4)) * 0.22 + 0.7 * grazing ** 7
                haze = np.clip(haze, 0, 0.9)[..., None]
                colour = colour * (1 - haze) + SKY_BLUE * (0.55 + 0.45 * lambert) * haze
                # Atmosphere glow for rays that miss, just above the limb.
                dist = np.sqrt(np.maximum(origin @ origin - b * b, 0))
                glow = np.where(~hit & (b < 0) & (dist < 1 + ATMOSPHERE),
                                np.clip(1 - (dist - 1) / ATMOSPHERE, 0, 1) ** 2.2, 0)
                rgb = np.where(hit[..., None], colour, GLOW)
                alpha = np.where(hit, 1.0, glow * 0.95)
                acc[..., :3] += rgb * alpha[..., None]
                acc[..., 3] += alpha
        acc /= SS * SS
        a = acc[..., 3:4]
        rgb = np.where(a > 1e-4, acc[..., :3] / np.maximum(a, 1e-4), 0)
        out[r0:r1, :, :3] = linear_to_srgb(rgb)
        out[r0:r1, :, 3:4] = a
        print(f'rows {r1}/{HEIGHT}', end='\r', flush=True)
    print()
    return out


def main(argv: list) -> None:
    if len(argv) != 4:
        print(__doc__)
        sys.exit(1)
    bm = np.asarray(Image.open(argv[1]).convert('RGB'))
    clouds = np.asarray(Image.open(argv[2]).convert('L'))
    out_dir = Path(argv[3])
    out_dir.mkdir(parents=True, exist_ok=True)
    img = render(bm, clouds)
    # Trim empty rows above the glow.
    rows = np.where(img[..., 3].max(1) > 0.003)[0]
    img = img[max(0, rows.min() - 4):]
    full = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    full.save(out_dir / 'earth-limb.webp', 'WEBP', quality=88, method=6, alpha_quality=90)
    half = full.resize((full.width // 2, full.height // 2), Image.Resampling.LANCZOS)
    half.save(out_dir / 'earth-limb-1920.webp', 'WEBP', quality=88, method=6, alpha_quality=90)
    for f in ('earth-limb.webp', 'earth-limb-1920.webp'):
        print(f, (out_dir / f).stat().st_size // 1024, 'KB', Image.open(out_dir / f).size)


if __name__ == '__main__':
    main(sys.argv)
