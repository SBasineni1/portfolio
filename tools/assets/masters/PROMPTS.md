# Launch-site masters

Each site is one 3:1 master painting (2172 × 724) cut into depth plates by
`tools/assets/plates.py` into `src/assets/sites/<id>/`. All five are imagined composites
inspired by the user's launch photographs, not reconstructions of real places. The reference
photos were used only as generation inputs and are not committed.

Desert predates this set; its history follows at the end. The other four were generated on
2026-10-09 with the Codex CLI's built-in image generation (`codex exec -i <style ref> -i <photo>`),
each with the shared brief below plus a location paragraph (for the plains re-roll the brief's
attachment sentence named three images: desert style, snowfield style, then the photo), on a flat `#FF00FF` sky that
`plates.py` keys out. Plains was re-rolled once with the snowfield master as a second style
reference because the first pass came out photographic and too saturated.

Regenerate plates after replacing a master:

    python3 -I tools/assets/plates.py desert src/assets/sites/desert
    python3 -I tools/assets/plates.py site <id> tools/assets/masters/<id>.png src/assets/sites/<id>

If a master's composition changes, update its cut lines in `site_plates()` and the effect
coordinates in `src/world/sites/<id>.ts` (both are master pixels).

## Shared brief

```
You are producing ONE background painting for an interactive weather-balloon portfolio website. Use your built-in image generation tool (do not write code to draw it). Attached images: the FIRST image is the STYLE reference (an approved painted desert launch panorama from the same website — match its painterly 2D animated-film background style exactly: clean layered shapes, broad warm/cool cel-shaded facets, subtle painterly transitions, restrained outlines, realistic proportions and daylight, no photographic noise). The SECOND image is the COMPOSITION/CONTENT reference photo for this new location (inspiration only; create an imagined composite, not a reconstruction).

Hard requirements for the output:
- Extremely wide 3:1 horizontal panorama (e.g. 3072x1024 or 2172x724), standing-height eye-level camera, deep focus, same scale and viewpoint as the style reference.
- The SKY must be a perfectly flat, uniform pure magenta #FF00FF fill (it will be chroma-keyed out and replaced by a live animated sky). No sky colour, no clouds, no sun, no gradient, no checkerboard. The terrain skyline edge must be clean and antialiased against the magenta.
- Nothing in the terrain may be magenta or pink.
- Layout like the style reference: tallest landforms reach no higher than ~15% from the top; the far landscape/horizon sits around 50-58% from the top; the open launch ground occupies roughly the bottom 28-32% with a LARGE EMPTY CENTRAL AREA (the balloon and its ground gear are drawn on top by code at the horizontal centre, about 75% from the top). Terrain spans edge to edge, bottom edge fully opaque ground.
- No people, no balloon, no windsock, no text, labels, logos or watermarks.

When the image is generated, copy the final PNG file to the exact output path given below (use a shell `cp` from wherever the image tool saved it), then print that path. Do not do anything else.
```

## plains

```
LOCATION: "Open plains" — a vast flat agricultural plain on a grey OVERCAST day (reference photo: people launching from a huge flat field under heavy cloud). IMPORTANT STYLE: this must be a PAINTING in the exact illustrated style of the first two attached images (painterly 2D animated-film background, broad simplified brush shapes, clean layered colour masses) — NOT a photograph, no photographic grass detail. Palette: muted overcast — dull olive-green and grey-green grass patches mixed with pale straw-coloured stubble and grey-brown bare earth; low contrast, soft diffuse light, no sunlight, no hard shadows, nothing saturated orange. Paint: a dead-flat field receding to a perfectly straight far horizon at about 55% from the top; a thin far line of small distant bluish-grey trees, a hedgerow, one tiny farmhouse and a few faint power poles on the horizon. The foreground launch ground is the same field, slightly trampled, with faint tyre tracks, open in the centre.
```

## snowfield

```
LOCATION: "Snowfield" — a high, rolling upland launch site after a light snowfall (reference photo: green hills with patchy snow, white shipping containers, a small white observatory dome, fence posts). Paint: rolling green-and-tan tussock hills with irregular patches of fresh snow; a distant range of low snow-dusted mountains on the horizon (left and centre); at left middle-distance a few white/cream shipping containers on a gravel pad, a small white observatory dome and a little instrument enclosure; a line of thin fence posts with wire running along the right hill; crisp clear daylight from upper left, cool blue shadows in the snow. Foreground launch ground: a gravel track and short grass with snow patches, open in the centre.
```

## basecamp

```
LOCATION: "Base camp" — a high Himalayan base camp below a giant snow massif (reference photo: Everest north face from base camp). Paint: a colossal snow-and-rock pyramid peak dominating the centre-right with wind-carved snowfields and dark rock bands, flanked by dark brown scree ridges on left and right that rise steeply; a wide grey glacial moraine valley floor of gravel and boulders; far small clusters of yellow and orange expedition dome tents and a couple of white 4x4 vehicles in the middle distance at right; thin intense high-altitude sunlight, deep cool shadows. Because this peak is enormous it may reach up to ~10% from the top. Foreground launch ground: flat grey gravel moraine, open in the centre.
```

## station

```
LOCATION: "Upper-air station" — a small national weather service upper-air office in flat green country, late afternoon golden light (reference photo: NWS office with a lattice tower, a white radome on a steel stand, a satellite dish, a low tan brick building, parked cars, trees). Paint: at centre-left a tall slender steel lattice tower with a small white sphere and instruments on top; at centre-right a large white radome (sphere) on a steel lattice stand; a tilted satellite dish on a frame in front of a low single-storey tan brick office building at right with a couple of parked cars; a small white shed at far left, distant trees on the flat horizon; mown green lawn with a concrete footpath. Warm low sun from the left casting long soft shadows to the right. Foreground launch ground: a dark asphalt launch pad across the bottom with the lawn edge, open in the centre. Keep the tower and radome well away from the horizontal centre third.
```

## Desert (2026-09-07)


`desert-photographic.png` was generated with the built-in image-generation tool on 2026-09-07.
It is an imagined landscape inspired by the user's Reno weather-balloon launch and Death
Valley reference photos, not a photograph or accurate reconstruction of a particular site.
The original 2172 × 724 RGBA output is preserved, including its transparent sky.

### Generation prompt

Use case: photorealistic-natural
Asset type: one wide photographic terrain foreground layer for an interactive weather-balloon launch website.
Primary request: Generate ONE photorealistic 3:1 panorama, ideally 3072x1024 pixels. A fictional composite landscape viewed from standing height in a Reno-style upper-air weather-balloon launch clearing. Make the entire sky genuinely transparent (actual PNG alpha), with a clean natural jagged mountain skyline; all terrain and structures below that skyline must remain fully opaque. This is an isolated landscape layer, not a photo printed on a background. Do not paint a sky, white fill, or checkerboard pattern.
Reference inspiration: The viewed launch photo provides a weathered gray asphalt launch apron in a sparse pale-sagebrush dry basin; the viewed Death Valley photo provides realistic rugged brown mountain ridges, deeply incised geological folds, and muted ochre/tan rock. Inspiration only: create a fictional composite, not a literal depiction of either geographic site.
Scene: distant continuous rugged brown mountain range, low pale sagebrush desert basin in middle ground, expansive weathered gray asphalt apron occupying the bottom third with a large empty central launch area. One restrained, very small utility shed far left in the middle distance, and a subtle fence at the far edge of the clearing.
Composition: extremely wide 3:1 horizontal panorama; tallest mountain peaks reach about 18% from top, base of distant mountains / basin horizon near 55% from top, central asphalt apron begins about 70% from top. Entire bottom edge opaque asphalt; terrain spans edge to edge, no floating island or fade. Realistic grounded standing-height camera perspective and deep focus. Mountains are substantial geologically textured ridges, with believable atmospheric depth.
Lighting: natural warm afternoon sunlight from upper left; realistic muted earth tones, dusty beige and soft sage greens, brown mountain shadows, gray pavement with fine aggregate.
Constraints: true transparent sky above skyline is essential for the live animated sky behind this image. No balloon, no people, no windsock, no text, no labels, no watermarks, no giant structures, no cartoon dunes, no stylized illustration. High quality natural photography.

### Illustrated style transfer


Created using the built-in image-generation tool as a style transfer of
`desert-photographic.png`. The user's approved mountain view, basin, sagebrush,
utility shed, fence and open asphalt launch area remain the composition reference.
The original photographic-style asset is retained separately.

#### Style-transfer prompt

Use case: style-transfer.
Asset type: transparent terrain layer for an interactive weather-balloon launch scene.
Edit target: the attached existing launch-terrain.png panorama. Create one polished 2D animated-film background version. Preserve the EXACT existing 3:1 panoramic composition and standing camera view: same mountain skyline silhouette and peak positions, same mountain basin horizon, same pale sagebrush placement, same small utility shed at left and subtle fence, same asphalt apron occupying the bottom third, same empty central launch area. Preserve realistic geographic proportions, depth, and daylight from upper left. This is a substantial, visibly illustrated style transformation: simplify photographic grit and tiny geological detail into clean layered shapes, broad warm/cool cel-shaded rock facets, subtle painterly transitions, restrained outlines, appealing tan/ochre mountain ridges with muted lavender shadows and sage-green scrub. The pavement should be smoothly painted with a few intentional restrained cracks, no photographic noise. Mountain volumes should read beautifully through broad deliberate brushwork and color shapes rather than thousands of tiny ridges. Keep the source landscape recognizable with all layout fixed.
Transparency is essential: export actual RGBA PNG with genuine alpha-zero transparent sky above the same mountain ridge and fully opaque terrain alpha 255 below. The black area in the reference represents transparency, not a black sky. Do not paint any sky or any checkerboard pattern; no sky color or black background. Clean natural antialiased mountain edges.
No new objects, no balloon, no people, no windsock, no UI, no text or watermarks. Do not crop, move mountains, change camera, add giant structures or change scene layout.

#### Final background-removal prompt

Remove the white and gray checkered background above the mountain skyline. Deliver a genuine transparent-background PNG: alpha 0 outside the terrain, opaque terrain. Preserve this illustrated landscape composition, same 3:1 proportions, same colors, ridges, sagebrush, shed and pavement. This is only background removal, do not repaint or recompose the terrain. No checkerboard, no sky, no background fill; genuine alpha transparency.

#### Display integration

The generator retained a checkerboard backdrop despite the extraction request, so `desert.png`
is RGB. `desert-skyline.json` (beside `plates.py`) records the measured skyline, one row per
source column; `plates.py desert` turns it into the far plate's alpha with a one-pixel inset that
excludes the antialiased backdrop edge. Update it if the desert composition ever changes.

## station-real (2026-10-09, comparison)

A photographic take on the station master for comparing looks (`?site=station&look=real`).
The first attempt (the painted master as the only input) came back as a re-sharpened painting,
so it was re-rolled with two inputs: the painted master for layout only, and the user's real
NWS upper-air office photograph for the look. Cut with the station's lines.

```
IMAGE 1 is a painted panorama that defines ONLY the layout: framing, camera height, horizon,
and the position and size of every object. IMAGE 2 is a real photograph of a US National
Weather Service upper-air office. It defines the LOOK: this must be indistinguishable from a
real photograph like image 2. Produce a genuine-looking PHOTOGRAPH of the image-1 layout, as if
shot on a full-frame camera (24mm, f/8, ISO 100) in late-afternoon golden sun from the left.
Natural, restrained colour grading like image 2: real grass greens, slight warm cast, realistic
dynamic range, NO HDR look, no over-sharpening, no painterly brush shapes, no 3D-render look.
Real materials: weathered asphalt with tar-sealed cracks, oil stains and faded patches; mown
lawn with real blade texture; galvanized steel lattice; radome panels with faint grime streaks;
tan brick with mortar lines; real cars; real trees with soft depth haze; subtle grain.
Long soft shadows falling to the right. Keep the layout of image 1 exactly (2172x724) …
The SKY must be a flat pure magenta #FF00FF fill exactly where the sky is in image 1.
```

## Photographic sites (2026-10-09, shipped)

After comparing the painted and photographic upper-air station, the user chose photographic for
every site. Each `<id>-real.png` was generated with the painted `<id>.png` as the layout lock and
the user's own launch photograph for that site as the look reference, using a shared brief that
names AI tells to avoid: HDR or tone-mapping, oversaturation, over-sharpening, plastic or waxy
surfaces, faceted rock, repeated patterns and garbled structures. It asks for straight-out-of-camera
colour, lens falloff and fine grain. Plates are cut with `plates.py site <id>-real …`, whose
cut lines were re-measured on each photo.

## Gear photographs (`gear/`)

Each is one real object on a flat #FF00FF background, prompted as "a real photograph of a real,
used object" with the same anti-tell list. Covers the windsock cloth and mast, helium cylinder,
weather mast (crossarm left bare for the live vane and cups), receiver case and tripod, sonde,
parachute and unwinder. `tools/assets/gear.py` keys them, erases the parts drawn live (the empty
hoop arm, the receiver whip and the sonde antenna) and writes 3× sprites to `src/assets/gear/`.

## Staging pads (`gear/pad-*.png`, 2026-10-10)

One photograph per site of a flat staging area, prompted with the same anti-tell list, shot from
standing height about 7 m away, on #FF00FF:
- **desert:** sandbagged plywood with a ratchet strap;
- **plains:** a staked canvas tarp;
- **snowfield:** a plywood deck on pallets with slush;
- **basecamp:** a blue tarp ringed with rocks;
- **station:** a concrete slab with a faded yellow circle.

The generator framed them from higher than asked, so the runtime flattens them per site (`squash`).

## Earth (`src/assets/earth/`)

This is not generated. `tools/assets/earth.py` renders it from NASA Visible Earth's Blue Marble Next
Generation (July 2004, topography and bathymetry, 21600×10800) and its 8192-px cloud layer, both
public domain. The source URLs are in the script's docstring; the sources are not committed.
