# Radiosonde Portfolio — Design System

Source of truth for every visual decision in this repo. No component is written without
reading it. If a value is not here, it does not go in the CSS; add it here first.

## Provenance and what was borrowed

The site's own idea — **the page is a sounding, not a stack of cards** — predates this
document and is kept intact. Layer B reference:
`~/.claude/skills/design-reference/library/haoqi.design.md` (captured from `haoqi.design`,
2026-09-04), paired with the "instrument panel" reading of this site's existing concept.

**Taken from the reference:**
- Display type **set solid** (line-height = font-size) so headlines lock into a block.
- A field grid with crosshair ticks across the viewport. *Adopted, later removed at the user's
  request (2026-10-10): the photographed sites carry the page now and the grid fought them.*
- Links framed by a **hairline `::before` bracket** on hover instead of an underline.
- **Accent rationing** — chroma earns its place by scarcity, not by decoration.
- Flat chrome: zero border-radius, zero box-shadow on UI. (This site already did this.)

**Deliberately NOT taken:**
- The reference's fixed navy stage and viewport lock. This site's ascent — sky lightening
  to space via `--dark` — is a stronger idea than a static field, and a fixed viewport would
  destroy it. We keep the scroll.
- The reference's `normal` letter-spacing on display type. That rule exists because its
  display face is already tight; Inter (still the nameplate face) is not, and set at 82px with
  `normal` tracking it reads loose. We keep a small negative tracking. **This is an intentional
  deviation.**
- Its acid `#c0fc04`. This site's accent is `--flare`, sampled from the balloon already on
  the canvas, and it belongs to the subject matter.

**Card stations (2026-09-04).** Projects, Experience and Education are full-width stations
whose card layouts follow two user-supplied references: rauno.me (horizontal rail of very large
cards with a typographic cover and a tick ruler) and adiprathapa.space (tinted photo cards with
logo / date / role / summary / tags; an education split of cover + text card). Those references
use rounded cards and per-card accent colours. **Both are adopted as a deliberate, bounded
exception** to the flat-instrument rules below — see §7. Cards are *content surfaces laid on the
sky*; the instrument chrome (altitude indicator, trace, ticks, rulers) stays square and flat.

The OpenAI marketing site was also requested as a reference; its capture is pending (the site
blocks headless capture and needs the Chrome extension). Type ramp and spacing may be retuned
once it lands, without changing any rule here.

## 1. Atmosphere & Identity

An instrument left running. The page is a radiosonde flight: you launch at a pale blue pad
and climb until the sky runs out. Nothing is a box — every section hangs off a single plotted
trace the way a temperature curve hangs off the pressure axis of a Skew-T, sitting directly
on the sky with only a haze behind it for legibility.

The signature is **altitude as structure**. The pilot-style indicator on the right is a real
axis with real ticks, each section sits at its own altitude, and its readout follows the actual
simulation. The top tab provides direct section navigation without breaking that spatial model.
Two instruments stay fixed for the whole flight: the top-center navigation tab and the right-hand
altitude indicator. Nothing else is fixed chrome any more — the mission strip and telemetry HUD
are gone.

Depth is rejected on purpose. The chrome layer is hairlines, ticks, and type — no shadow, no
radius, no fill. All atmosphere lives in the canvas behind it: the sky gradient, the balloon,
the haze. That split is the architecture — **flat precise instrument in the DOM, lit world in
the canvas** — and it is why the UI never competes with the scene.

The world is three canvases. `#sky` carries the sharp procedural atmosphere (five-stop gradient,
horizon haze band, brush-stamped cumulus, cirrus, sun, limb, stars). `#sky-soft` redraws that
scenery at 1/12 scale (1/8 under low power), smooths it through half- and full-size upscales, and
dims it to 72%; `--focus` crossfades this fixed-softness layer over `#sky` whenever a text station
is in view, so prose always sits on a soft ground without an animated CSS filter. `#scene`
carries the balloon and near clouds and is never softened. The balloon itself is **painted live in
the scenery's style and lit by the scene**. The same balloon flies from every site, and
`Scenery.balloonLight` describes the light it is in. The key comes from the site's sun: white, gold
at golden hour, and gone under overcast, where the light turns soft and overhead. Shadows and the
rim take the sky's colour and deepen toward space. The envelope is the Verlet ring's own
silhouette, so a grab still pinches it and pressure still bulges it, painted as a lit mass and a
shadow mass split by a short soft terminator, with a cool sky rim on the shadow side, a soft gather
into the tied neck and a single highlight in direct sun. Down the tether, the flight train is
**photographed**: keyed photos of a collapsed orange parachute with its shroud lines and swivel,
a styrofoam line unwinder, and a modern sonde with its sensor boom. Each is tinted by the scene
light and rotates with the line. The sonde's wire antenna and its green status LED are drawn live,
so the antenna swings. Painted stand-ins draw only until the photos decode. The envelope stays
painted, because only a painted envelope can deform with the Verlet ring. Everything shares one
`SceneLight` (`src/world/paint.ts`).

**space** borrows its starfield from the CornellGeoData site's hero
(`CornellGeoData/Official-Website`, `src/pages/home/`), adapted to an altitude-driven scene:
- **Starfield** (`src/world/stars.ts`, after its `Sky.tsx`):
  - a dense field of up to 1800 stars, 75% faint pinpricks, 20% mid and 5% bright with a soft glow,
    a few of them carrying four-point glints;
  - the faint ones are pre-drawn to a tile that drifts left at 10px/s (plus the shared wind drift)
    and sinks slightly with altitude;
  - the brighter ones twinkle, and shooting stars and slow comets cross every 3–9s once the sky is
    dark;
  - the whole field fades in with `starVisibility`. Under reduced motion nothing drifts, twinkles
    or streaks, and the blurred background copy gets only the static tile.

**The Earth** below near space is one static, high-resolution photograph-like image
(`src/assets/earth/`, 3840 px, 1920 px on low-power devices), rendered offline by
`tools/assets/earth.py` from NASA's public-domain Blue Marble (July 2004 topography and bathymetry,
21600 px) and its cloud layer:
- the camera hangs above the central United States looking north-east over the Great Lakes;
- it is ray-cast with 2×2 supersampling and bilinear samples, lit from the upper left in linear
  light, hazed toward the limb, and ringed by a soft atmosphere glow in the alpha.

Nothing renders live. The image starts very wide, so the horizon reads nearly flat at 5 km, and
narrows to just wider than the viewport by burst, so the curvature grows. It must always reach
the bottom edge: on a tall phone it first takes a wider crop, up to 1.9 viewports so the curve
still reads, and then sits the horizon lower. It never stretches its last rows, which streaks. It loads lazily above
2.5 km, and the procedural limb stands in until it decodes. A live ray-cast globe was tried first
(2026-10-09) and reverted because it rendered too soft at viewport scale.

The launch happens at one of **five sites**, picked at random per visit (never the
site this browser launched from last) and switchable from the site picker (§5):
high desert, open plains, snowfield, base camp and upper-air station. Each is an imagined
composite inspired by a user-supplied launch photograph, not a reconstruction of a real
location. All five are **photographic**. Each master was generated with the painted panorama as
the layout lock and the user's own launch photograph as the look reference, and prompted
explicitly against AI tells: no HDR, no oversaturation, no faceted or waxy surfaces. The painted
masters remain in `tools/assets/masters/` as layout references. The user compared the two looks on
the upper-air station and chose photographic for every site.

A site is a stack of **depth plates** cut from one master painting (`tools/assets/plates.py`;
masters and prompts in `tools/assets/masters/`). Every plate keeps the master's canvas and has
its own ground line, `base + altitude · depthK`, so at the pad the plates reassemble the
painting exactly and on the climb the apron (`depthK` 3.2, the shared ground rate that keeps
the gear seated) falls away two to five times faster than the far range (0.7–1.4). The far
range is compressed from true parallax on purpose, so the landscape has sunk below the About
copy by 260 m. Each back plate is painted down to the bottom edge with a repeated band of its
own terrain, so parallax never opens a hole, and hazes toward the site's aerial colour before
dissolving. The launch gear (`src/world/pad.ts`) sits on the near plate at the site's `groundRow`. It is
**photographed** (keyed sprites from `tools/assets/gear.py`, stored at 3×) and tinted by the same
`SceneLight` as the balloon. The parts that move are drawn live, and **all of them answer the
pointer**:
- **Windsock.** The photo sock is strip-warped along a centreline that fills and lifts with the
  live wind and flaps toward the tail. Sweeping the pointer through it fans it; a click blows a
  gust the balloon feels too.
- **Weather mast.** A tripod station whose wind vane swings into the wind on a damped spring, and
  whose cup anemometer spins at wind speed. A click spins both; brushing past flicks them.
- **Receiver.** The ground-station case and tripod. Its white antenna whip springs when poked or
  brushed.
- **Helium cylinder.** A click cracks the valve for a puff that drifts downwind.

Each piece casts a shadow away from the site's sun: long at golden hour, a contact smudge under
overcast. Phones drop the receiver for room. Under reduced motion nothing moves and pokes do
nothing.

**Fitting into the photograph.** Everything placed on a site is graded to that site's photograph.
When a site's plates decode, the terrain measures the near plate around the pad: its average
ground colour, and its darkest fifth for the shadow colour. Both are eased through switches and
carried on the shared `SceneLight` as `ground`, `shadow` and `bounce`:
- **Gear photos** are multiplied by the key light, scaled to the site's exposure (a bright desert
  apron lifts them, dark asphalt holds them down) and washed 14% toward the ground colour.
- **Contact shadows**, and the envelope's cast shadow on the pad, use the measured shadow colour.
  The cast shadow falls away from the sun, sharp near the pad and spreading and fading as the
  balloon climbs; under overcast it is only a broad, faint darkening.
- **Ground bounce.** The envelope's underside picks up the ground colour near the pad (warm off the
  desert, green off the station lawn), fading within a few hundred metres.

**Staging area.** Each site has a photographed staging pad under the balloon (`SiteStage`):
- **Desert:** sandbagged plywood with a ratchet strap.
- **Plains:** a staked canvas tarp.
- **Snowfield:** a plywood deck on pallets.
- **Base camp:** a blue tarp ringed with rocks.
- **Station:** a concrete slab with a painted launch circle.

There is no real "launch pad" in balloon practice, but a staging area is what ties the sonde, gear
and balloon to one place on each site. Each pad is flattened (`squash`) to match the site
photograph's ground foreshortening, centred on its footprint centroid under the sonde, and graded
like the gear. The tools stand at per-site spots around it: x is offset from the pad centre at a
1200px viewport, pulling in on narrower screens, and y is toward the camera, which draws slightly
larger. Only the balloon is always in the same place. The sonde's contact shadow and the
envelope's cast shadow fall on top of the pad.

**Switching sites.** The gear packs away the moment a switch starts: everything sinks 10px and
fades out in 0.22s. Once the new site's plates show, it sets back up one piece at a time (the pad first,
then the mast, receiver, cylinder and windsock), each rising over 0.5s and 0.11s apart. Half-faded gear cannot be
poked; under reduced motion it simply swaps.

Each site carries its **own sky near the ground**, which merges into the shared ascent
palette between 1.7 and 3.2 km depending on the site: desert keeps the 22% warm tint, plains is a grey overcast with the
sun hidden, snowfield is crisp and cool, base camp is a deep high-altitude blue, and the
station is late-afternoon gold with a low sun. Plains adds a stratus deck at 700–1350 m: a
ceiling from the pad, fog over the balloon inside it, and a sea of cloud tops sinking away
once the ascent breaks out. Live effects animate each site and all read the same wind:
cloud shadows sliding over the ground, dust off the apron and a passing dust devil (desert),
leaning stubble and birds (plains), spindrift and a fog bank in the hills (snowfield), a
summit banner cloud, spindrift and prayer flags (base camp), and a spinning anemometer,
blinking obstruction lights and birds (station). While a site's plates decode the sky stands
alone and the plates fade in over it; the procedural desert appears only if they fail to load.

Moving between stations is not a simple park-and-forget. The default `physics` mode makes an
entering station latch an **exit**: the station-keeping home moves from mid-screen out to
`width + EXIT_CLEARANCE`, and one decaying gust impulse kicks the balloon toward it — it leans
right, the tether whips, the sonde trails, canvas streaks spike. The switchable `track` mode
(`?motion=track`) suppresses that gust and moves the home along a smootherstep-sampled quadratic
Bézier rising off the right edge, then reverses the same path when the exit releases. The
station's cards sweep in only once the balloon's leftmost point has
cleared the viewport: a 0.4s gate that, once it starts, latches open regardless of what the
balloon does afterward. When the station falls out of view the exit releases and the balloon
drifts back in from the right. Reduced motion never moves the assembly — it fades in (`fade`) on
the same gate instead.

## 2. Color

Everything is mixed between two endpoints by `--dark` (0→1, written per frame from the flight),
so there is no threshold and no light-switch moment.

| Role | Token | Value | Usage |
|---|---|---|---|
| Ink at pad | `--ink-day` | `#08131f` | Daylight endpoint |
| Ink in space | `--ink-space` | `#e9f1f8` | Near-space endpoint |
| Ink | `--ink` | `color-mix(in oklab, day, space, --dark)` | Headlines, body |
| Ink 2 | `--ink-2` | `--ink` @ 78% | Secondary prose |
| Ink 3 | `--ink-3` | `--ink` @ 56% | Labels, metadata |
| Hairline | `--hair` | `--ink` @ 25% | Traces, rules |
| Hairline strong | `--hair-strong` | `--ink` @ 64% | Section underlines, ticks |
| Sky | — | `#7ea7cd` | Body background under the canvas |
| Accent | `--flare` | `color-mix(in oklab, #d1521c, #f4a052, --dark)` | See rationing below |
| Chrome paper | `--chrome-paper` | `--ink-space`, flips to `--ink-day` under `.sky-dark` | Readout text on the altitude box |

Chrome that is on screen for the whole flight (`--chrome-*`) **steps** rather than blends —
it sits over an unpredictable sky and needs to stay legible, so it switches with `.sky-dark`
plus a stacked three-layer `--chrome-halo` glow.

### Rules
- Never introduce a colour outside this table. Extend the table first.
- No greyscale ramp. Hierarchy is `--ink` at three alphas, plus size and family.
- `--flare` is **rationed**. The complete permitted inventory:
  1. measurement marks — isobar bullets,
  2. the organisation line in an entry,
  3. the ruler's current tick (`.ruler__tick.is-current`),
  4. the global `:focus-visible` ring.
  It is **not** a link colour, **not** a hover colour, **not** a text underline, and no longer
  a section label: section kickers are plain ink (§5 Panel). Links use the bracket frame in §5;
  emphasis rules use `--hair-strong`. Keep the list this short; if you need another job,
  remove one first.
- **The nav icon carries the altitude.** Its background runs a seven-stop ramp, one stop per
  layer of sky: `#d1521c` at the pad, `#e07a26` at 2.5 km, `#d29a1d` at 7 km, `#1f9a8f` at 12 km,
  `#2a74c9` at 18 km, `#4f4fc8` at 26 km and `#8d4fc9` at 34 km. `nav.ts` writes the two stops
  either side of the current altitude, and CSS blends them with `color-mix(in oklab, …)`. It is
  the one chrome colour that moves with the flight, so it is not `--flare`.
- **Per-card `accent` is content, not palette.** A card may carry an `--accent` (from its data
  record) used only inside its cover slot: the experience/education tint and the fallback
  cover. It never colours text, chrome, borders or links. The paper stock and its local ink
  family (`--card-paper`, `--card-ink`) are fixed and do not follow `--dark`, because `--dark`
  saturates at 7 km while the sky is still blue and a card is a printed object, not sky.
- Depth is forbidden in the DOM: no `box-shadow`, no `border-radius`, no CSS gradient on UI,
  with **two documented exceptions**: the navigation tab — black, 18px bottom radius, 20×20
  inverted-corner flares, adopted from the user's supaste.com reference — and **cards** (§5),
  which carry a 16px radius, a hairline frame and, on tinted covers, a bottom-weighted scrim.
  Cards are content surfaces; do not use either as precedent for the chrome layer. `text-shadow`
  haloes exist for legibility over an unpredictable sky, not for depth.

## 3. Typography

Two families, one display and one data, plus one sanctioned exception: the hero's name and
description stay in **Inter** (`--hero-face`). The user tried them in Cal Sans and preferred
Inter there. Inter appears nowhere else.

- **Display / UI:** `Cal Sans` v2 (variable; SIL OFL), with fallback `ui-sans-serif, system-ui, Helvetica Neue, Arial`.
- **Data / telemetry:** `Martian Mono` (variable, `wdth` 75–112), `ui-monospace, SFMono-Regular, Menlo`.

**Why Cal Sans.** The user asked for a face that reads as chosen rather than the default every
generated site reaches for, and Inter is that default. Cal Sans v2 is a geometric sans in the
Futura line, with a variable **GEOM** axis between a humanist "text" drawing and pure geometry.
That axis is the site's typographic signature: display type (nameplate, section titles, big card
titles) sets `GEOM 100` (`--geo`) for round bowls and single-storey forms. Body and UI keep the default `GEOM 25`, which is
the readable drawing. `font-optical-sizing: auto` on `body` picks the optical size (8–45) from the
font size, so small text gets wider spacing and blunter corners automatically.

**Self-hosted subset.** `src/assets/fonts/CalSansVF-latin.woff2` (92 KB) is built from the `cal-sans`
devDependency:
- pin `ital=0` and `YTAS=1440` with `fonttools varLib.instancer`;
- subset to Latin with `pyftsubset … --layout-features='*' --flavor=woff2`.

`opsz`, `GEOM`, `wght` (400–700) and `SHRP` stay live. The licence is beside it as `OFL.txt`.
Martian Mono and Inter (for the hero only) still load from Google Fonts.

**Cal Sans has no width axis.** Hierarchy is built on **size + weight + case + GEOM**, and
`font-stretch` must never appear on a display-face rule. It stays on `--data` rules, where
Martian Mono's width axis is real and load-bearing: condensing the data face to 76–88% is what
makes a measurement read as a measurement.

### Scale

| Level | Size | Weight | Line height | Tracking | Family | Usage |
|---|---|---|---|---|---|---|
| Nameplate | `clamp(34px, 6.6vw, 82px)` | 800 | **1** (solid) | −0.022em | Inter | `.hero__name` |
| Section kicker | 13px | 650 index / 500 caption | 1.3 | 0 | display | `.panel__band`: `01 — Surface · 0–0.9 km` |
| Section title | `clamp(32px, 3.2vw, 46px)` | 700, GEOM 100 | **1** (solid) | −0.028em | display | `.panel__title`, sentence case |
| Section lede | `clamp(17px, 1.35vw, 19px)` | 400 | 1.5 | −0.012em | display | `.panel__lede`, `.station__lede`, ≤44ch, full ink |
| Section body | 15px | 400 | 1.65 | normal | display | `.panel__body p`, ≤56ch, `--ink-2` |
| Tagline | 16px | 400 | 1.5 | normal | Inter | `.hero__tagline` |
| Entry title | 15px | 650 | 1.25 | −0.005em | display | `.entry__title` |
| Entry org | 12.5px | 550 | 1.5 | normal | display | `.entry__org` |
| Body | 13px | 400 | 1.7 | normal | display | `.entry__text`, bullets |
| Small body | 12px | 400 | 1.8 | normal | display | `.hero__hint` |
| Eyebrow | 9.5px | 500 | — | 0.24em | data @78% | uppercase |
| Meta / dates | 9.5px | 400 | — | 0.12em | data @76% | uppercase, tabular |
| Altitude label | 9px | 400 | — | 0.14em | data @78% | tabular |
| Altitude value | 12px | 600 | — | 0.04em | data @88% | tabular |

### Rules
- **Display type is set solid**: `line-height: 1` at nameplate and section title. Multi-line
  headlines lock into a typographic block. This is the single most important borrowed move.
- Weight carries what width used to: 800 nameplate (Inter) → 700 title → 650 entry → 550 org →
  400 body. Cal Sans tops out at 700, so 700 is its display weight. Its variable axis makes 650/550 real
  values; do not round them to 600/500.
- GEOM 100 belongs to display type only. Never set it on running text: the pure-geometry `a`
  and `t` slow reading at body sizes.
- Tracking is negative only at display sizes (−0.022em Inter nameplate, −0.015em cover titles,
  −0.005em entry title), because Cal Sans's display optical size is already tight. It is positive
  only for uppercase labels and data text. Body text is always `normal`.
- All measurements — altitudes, dates, pressures, layer names, tags — are set in `--data`,
  condensed, uppercase, `tabular-nums`. Prose is never set in the data face.
- Body never below 12px. Instrument labels may go smaller because they are tracked.

## 4. Spacing & Layout

Base 4px. Layout tokens: `--gutter: clamp(20px, 5vw, 84px)`, `--panel-w: min(452px, 42vw)`,
`--tape-w: 120px` (72px at ≤900px), `--alt-axis: 14px`, `--trace-gap: 26px`.

- The altitude indicator reserves a full column on the right; panels **and the hero** stop at
  its edge and never overlap it.
- Sections alternate left/right off the trace; the trace is continuous down the whole page.
- Breakpoints: 900px (the altitude indicator narrows to 72px), 520px (nav and trace tighten).

### Phones (≤520px, upright)
An upright phone has no room beside anything, so the layout stacks around the balloon, which owns
the middle of the screen:
- **Hero.** It sits up under the nav (72px). The name, wrapping to two lines, and a 104px
  Polaroid share the first row; the tagline runs full width beneath at 14/1.45.
- **Ground.** It is raised to 200px above the bottom edge (`setGroundInset`, below 560px), so the
  pad and gear stay clear of the launch tag and the compact launch note along the bottom. The
  near plate's last tenth is stretched down to fill the foreground below the ground line.
- **Panel position.** Panels stay bottom-anchored, but their top never rises above 84px, just
  under the fixed nav. A tall panel runs off the bottom rather than hiding its heading.
- **Text panels.** About parks the balloon off-screen like a station does, latching at `--in` 0.75
  so it cannot fire before release at the pad. Contact keeps the balloon, because its copy is about
  the parachute in view. This applies below 900px, wherever panels are bottom-anchored.
- **Smaller pieces.** Cover titles wrap at 13vw instead of bleeding off the card. Contact rows put
  the label over the value, so addresses never break mid-word. Fact rows use an 88px label column.
- **Touch wording.** Touch screens read "Tap", not "Click", in the Polaroid hint.

### Field grid
Removed (2026-10-10). There is no overlay between the canvases and `#content`; do not reintroduce
one without the user asking.

### Stations
Projects, Experience and Education are `.station` sections: full width minus the tape column
(`left: 0; right: var(--tape-w)`), positioned at their band altitude by the same layout as the
panels, height ≤ 0.82 viewport. A station is head (band annotation, solid-set title, lede ≤ 48ch,
ruler at the right) over a body: a horizontal `.rail` of cards, or the education split. Below
900px the tape collapses to labels and the rail dissolves under them with a mask over its last
104px. The balloon exits right while a station is in view.

## 5. Components

### Site picker
Fixed bottom-left at `--gutter`, on the pad only. It fades out on `--launch` and goes `inert` once
that fade passes 90%.

It is a **launch tag**, modelled on the manila "if found, return" tag real sondes fly with:
- **Stock and ink.** Card stock `--tag` `#e6d6ae` printed in one ink, `--tag-ink` `#16120b`. There
  are **no greys and no tinted-white text**: hierarchy is size and weight in that single ink.
- **Shape.** The left end is chamfered with a 14px `clip-path`, and a real punched hole (a CSS
  mask, so the scene shows through) sits in a brass-ring reinforcement, `#9a7a3c`.
- **Readout.** The site number is a 28px Cal Sans 700 numeral at `GEOM 100`, with a small `/05`.
  A 1.5px ink rule follows, then the site name at 15px/650.
- **Buttons.** Bare 2.2px square-capped ink chevrons in 30×30 buttons, with no outline boxes. On
  hover they invert to an ink block with tag-coloured chevrons, like a stamped mark.
- **Loading.** A short ink bar sweeps along the tag's bottom edge while plates load.

This is a bounded exception to the flat-chrome rules, like the cards and nav tab: it is an object
on the ground, not instrument chrome. The name is `aria-live="polite"`, ArrowLeft/Right step sites
while focus is inside, and it uses no `--flare`. While the launch note is open and the two would
overlap, the tag lifts to sit 10px above the note. If a picked site's plates fail to load, the
scene stays where it was and the tag follows it back.

**Picker motion** (GSAP):
- It rises in 0.55s after load: `--enter` fades it in and it lifts from 18px, then the buttons pop
  in.
- A switch slides the old name out against the direction of travel and the new one in along it,
  rolls the count, and nudges the arrow that was pressed.
- While a site's plates load, a short bar sweeps along a hairline under the slab, so a slow
  switch reads as loading rather than lag.

Switching crossfades the plates over 0.45s (the old site fades out as the new one fades in), eases the sky over the
same period (instant under reduced motion), and writes `?site=` and the remembered site. A
switch asked for mid-fade waits for that fade to finish, so the picture never jumps.

### Launch note
The "Cleared for launch" note shows **on every visit** while the balloon is on the pad. It is
cheap to show: it sits beside the balloon and leaves by itself once the tether is released. A
visitor arriving mid-flight (a shared `#section` link) never sees it.

On desktop (≥900px) it is a **callout docked beside the balloon**:
- `toast.ts` places it 30px off the envelope on whichever side overlaps the portrait and intro
  least. It is kept 170px clear of the bottom edge, where the staging pad and gear live, and
  inside the tape column.
- A small diamond pointer aims at the envelope's centre.
- It eases after the balloon, so dragging tows it. It only switches sides when the other side is
  clearly better, so a bobbing balloon cannot flip it back and forth.
- It is positioned with `left`/`top`, never `translate`, because GSAP would fold a CSS translate
  into its own transform and apply the offset twice.

On narrow screens it stays a slab along the bottom edge. It appears 1.1s after load and arrives
as one GSAP sequence:
- the slab rises and scales up from 0.97;
- the signal dot pops and pings three times;
- the title rises word by word and the copy line by line, each out of a mask;
- the actions settle in last.

It leaves in 0.22s when the balloon's tether is released from the pad (the same 55 m release
that frees the balloon, roughly 120px of scroll) or on dismiss. It is never tied to a raw scroll
threshold: page nudges, Mac overscroll and the balloon's settle-in bounce on load all happen
while the balloon is still tied down.

**A reload is a new launch.** `main.ts` sets `history.scrollRestoration = 'manual'` and, on a
reload, drops any `#section` the nav or note wrote, so the page always comes back on the pad.
Otherwise the browser restores the old scroll position (or jumps to the fragment) about 50ms
after load. That flies the balloon up, and the note reads it as the visitor scrolling and leaves
before it ever opens. A fresh visit to a shared `#section` link still deep-links.

### Profile Polaroid
The hero portrait is an **instant-film print**, a physical object in the same family as the launch
tag:
- **Format:** an 88:107 card with a square photo set 5.1% in, a deep bottom border, and a cream
  matte frame (`#f3efe6`) with the photo slightly recessed.
- **Bottom strip:** left blank on purpose. The hero copy and About already say who this is, and
  the print must not repeat them.
- **Holder:** a small cloud (inline SVG) is stuck over the top edge at −11°, where tape would be. It is
  coloured per site (`LaunchSite.cloud`: lit top and shaded base, written as `--cloud-top` and
  `--cloud-base` and eased over 0.6s on a switch): sand in the desert, grey under the plains
  overcast, cool blue on the snowfield, cold blue-white at base camp, and peach over mauve at the
  golden-hour station. It is muted on purpose, with a 1.1-unit blur on its outline, 93% opacity
  and a faint shadow, because a pure-white crisp cloud read as a sticker.
- **Links.** The photo is a link to LinkedIn and leans in 3.5% on hover. On the back, the GitHub
  avatar sticker links to GitHub. Only the face showing takes clicks or tab focus.
- **Angle:** it rests at −3.5°.
- **Shadow:** it is a bounded exception to the flat-chrome rules (an object, not chrome) and
  carries the one soft drop shadow in the DOM.

Motion (`src/ui/profile.ts`, GSAP; none of it under reduced motion):
- **Drop in:** it falls 150px from −15° and settles at rest with `back.out(1.5)` over 1.05s.
- **Develop:** the photo goes from washed-out film (`brightness 1.55, contrast 0.55, saturate 0,
  sepia 0.3`) to full colour over 2.4s, like real instant film.
- **Tilt:** on fine pointers it tilts toward the cursor, up to 8° and 6°, while the hero is on
  screen.
- **Flip:** a click on the frame (not the photo or avatar) or on the hint, or Enter on the hint,
  turns it over in 1.5s (`cubic-bezier(0.1, 0.7, 0.3, 1)`); a horizontal swipe turns it in 0.6s.
  A swipe that ends on a link does not follow it. The back is black film with the GitHub avatar on a cream
  sticker and the handle in the data face. Vertical touches keep page scrolling.

The hint reads "Click here to flip" until the first flip, then names the link on the face showing:
"GitHub! Click again" on the back, "LinkedIn! Click again" on the front. It is also the keyboard flip
button. It sits inside the print's wrapper, so it shares the −3.5°
angle and drops, rests and tilts with the card. There is no separate GitHub link under it, because the
back of the print carries the handle. The hero is two columns on desktop and stacks below 900px.

### Link (`.entry__links a`, `.links a`) — the signature interaction
No underline, no accent border, no colour change. A `::before` pinned `inset: 0` carries a
1px `--hair` border at rest that goes to `--ink` on hover — a measurement bracket closing
around the reading.

**Deviation from the reference:** it leaves the rest state fully transparent. That works for
nav items in fixed positions; it fails for links inside prose, which then have no affordance
at all and read as plain text. Verified in QA — do not "restore" the transparent rest state.

```css
a { position: relative; padding: 2px 6px; text-decoration: none; color: var(--ink); }
a::before {
  content: ''; position: absolute; inset: 0;
  border: 1px solid var(--hair); border-radius: 0;   /* quiet, not invisible */
  transition: border-color 0.3s cubic-bezier(0, 0, 0.2, 1);
}
a:hover::before { border-color: var(--ink); }
```

Focus needs no rule of its own here — the global `:focus-visible` already draws a `--flare`
ring, and the bracket is bound to `:hover`, so the two never stack. The reference site shipped
no visible focus state at all; that part is deliberately not copied.

### Panel (the section template)
Every section, panel or station, opens the same way. The aim is an editorial page, not an
instrument readout, so it carries no orange, no tracked monospace caps and no full-width rules
under titles:
1. **Kicker** (`.panel__band`, built by `sections.ts` from `bands`): the section number in ink,
   a short 18px hairline, the layer of sky, then `·` and the altitude range in km without trailing
   zeros.
2. **Title**: Cal Sans 700 at `GEOM 100`, sentence case, set solid, −0.028em.
3. **Lede**: one or two sentences a step above the body, in full ink, at most 44ch.
4. **Body**: paragraphs at 15/1.65 in `--ink-2`, at most 56ch.

Panels still hang off the trace (the left hairline), with no background, border or radius.

**Content slots** (`content.ts`): About has `lede`, `paragraphs` and `facts`, a list of
`{ label, value }`. Facts render as an "at a glance" list of rows between hairlines, with a
112px label column in `--ink-3` and the value in ink; leave `facts` empty to hide it. Stations
take their lede from `site.ledes`.

**Contact rows.** Each link is a full-width row between hairlines: label column, the value at
17px/550, and a `↗` that steps up and right on hover. The whole row is the link. The bracket
frame is reserved for inline links (`.entry__links`). The footnote is plain 13px `--ink-3`.

### Entry
Title row (title left, date right in condensed data face), org line in `--flare`, prose,
then bullets whose markers are 8px isobar ticks — never dots.

### Altitude indicator
Pilot-style: a scrolling strip built from `tape.ts` at the real 0.086 px/m, three tick lengths
(250 m minor, 500 m mid, 1 km major), `k`-suffixed kilometre labels with a bolder read every
5 km, and a seated readout box whose pointer lands on the axis. It is the only live telemetry
left on the page.

### Navigation tab
Supaste-derived: fixed top-center, black, hanging from the top edge with 18px bottom corners and
20×20 inverted-corner flares. A 30px balloon-glyph icon plus wordmark (never wrapped: the tab is
`width: max-content`), Cal Sans 14px links (About, Projects, Experience, Education), and Contact
set as a white pill CTA. `is-current` is driven by the band altitude thresholds (a band lights
1.2 km before its range, and never before halfway to its own altitude, so About is not lit on the
pad); items scroll via `scrollToAltitude`. The tab narrows in steps: tighter gaps at 1000px; the
wordmark and the sandbox label drop at 760px; phone sizes at 520px and 400px; at 350px the sandbox
toggle steps out.

### Rail
`overflow-x: auto`, `scroll-snap-type: x mandatory`, gap 20px, trailing 40vw padding so the
last card can snap to start. **Never intercepts the vertical wheel** — the page scroll is the
ascent. Horizontal trackpad and shift+wheel scroll it natively; mouse drag (with snap released
while dragging and the trailing click suppressed after >6px); ArrowLeft/Right when focus is
inside. `cursor: grab`.

### Card
The one rounded surface: 16px radius, 1px `--hair` frame, `--card-paper` stock with its own ink
family. One `--card-pad` (24px, 18px on narrow) drives every inset. Sizes: project 60vw × 55vh,
experience 40vw × 55vh (76vw / 72vw × 46vh below 900px). Each card sets `--i` for the sweep
stagger and may set `--accent`.
- **Project card**: a cover, then body (description, tags, links). No label row: the cover's
  display title is the card's heading. The default cover is typographic — the title in the
  display face at up to 176px (capped at 42% of the cover's height), set at the bottom-left; a
  long name wraps to a second line rather than running off the card.
- **Project preview** (`preview?`, a 16:10 screenshot in `public/projects/`): on a pointer that
  can hover, hover or keyboard focus opens it as a window in a fixed layer above the page
  (`src/ui/preview-pop.ts`), its lower edge seated in the cover and rising over the card and the
  sky above, stopping below the nav. It blooms from a thumbnail at the pointer (expo-out, 0.6s)
  and shrinks back to it on leave; any scroll cuts it at once, and it reopens for the card under
  the pointer when the scroll settles. Resting 2s on a card (page and rail both still, section
  fully in) opens the settled card's window without a hover. Only the card the rail has settled on (≥90% in view)
  opens one, never a neighbour at the fade. It lives outside the rail so the rail's clip and
  fade never cut it. Hairline frame, no shadow. On touch it rises inside the cover, cropped at the bottom,
  once the card is mostly in view. The display title fades out while either is up.
- **Experience card**: the cover *is* the surface — a photo under an `--accent` tint with a
  bottom-weighted scrim, or the tint alone. Logo slot top-left (image, or the org name in the
  data face). Content bottom-left: date eyebrow, role at 22/650/−0.02em, summary 14/1.55, tags.
  Text is always light on the tint.
- **Education split**: cover (4:3, tinted, wordmark fallback inset 24px) beside a text card
  (school + location head row bounded by hairlines, degree, description, courses as tags,
  dates footer); later entries as hairline rows below.

### Cover slot
Every card has `cover?` (and experience/education `logo?`) in its data record. Files go in
`public/covers/` and are referenced with `asset('covers/x.jpg')`. Until a file exists the
designed fallback renders; adding one changes nothing else.

### Ruler
One 1×14px `--hair-strong` tick per card, the current one 2×20px in `--flare`, plus a
`01 / 03` count in the data face. Driven by rail scroll position, not by IntersectionObserver.

## 6. Motion

- Easing: `cubic-bezier(0, 0, 0.2, 1)` (ease-out) for interaction; `cubic-bezier(0.2, 0.7, 0.2, 1)`
  for existing entrance transitions.
- Durations: 0.3s interaction, 0.26s chrome step, 0.8s section entrance.
- `--dark`, `--in`, `--sweep` and `--focus` are **continuous scroll-linked signals**, so nothing
  needs a colour transition — the change is already smooth. Do not add one. `--focus` (max
  station presence) crossfades the pre-softened, dimmed `#sky-soft` layer over `#sky`; its blur
  radius is fixed by `SOFT_DIVISOR`. `--sweep` drives the station body's
  `translateX((1 − sweep) · 60vw)` and the per-card `--i · 8vw` stagger (see the next bullet for
  how `--sweep` is actually derived on a station).
- **Exit → gate → sweep** replaces a threshold class. A station's `--in` crossing 0.15 upward
  latches `exit`. In the default `physics` mode it fires one `GUST_PEAK` impulse through the
  balloon's wind path (0.35s decay) and moves the station-keeping home directly offscreen. In
  `track` mode (`?motion=track`) it fires no gust and advances that home along the 1.1s exit
  track instead; `?motion=physics` selects the default explicitly. In both modes,
  crossing back below 0.05 releases it — 0.15/0.05 hysteresis so a jittery scroll can't chatter.
  While exited, the station-keeping home moves out to `width + EXIT_CLEARANCE` (420px past the
  edge). The station body does not sweep on `--in` alone: a gate advances over 0.4s once the
  balloon's leftmost point clears the viewport, and once started keeps advancing regardless —
  it latches. `--sweep` is `smoothstep(gate)` min'd with `--in` itself, so a station can never
  sweep in further than it has already faded in.
- **Arrival, not ambience.** Page motion marks an arrival or answers an interaction; nothing
  in the DOM loops for decoration. Choreography runs on GSAP (`src/ui/motion.ts`, with SplitText
  registered). The scroll stays the only clock for *where* things are, so GSAP never owns the
  scroll: no ScrollTrigger and no ScrollSmoother. `sections.ts` reports when a section has
  arrived (`--in` ≥ 0.5, or `--sweep` ≥ 0.35 for a station's cards) and when it has fully left
  (below 0.05). `src/ui/reveals.ts` plays and resets on those events:
  - band label chars flick on;
  - title chars rise out of a line mask (`expo.out`, 0.024s stagger);
  - lede, body copy and the contact foot rise line by line (0.07s stagger);
  - contact links settle up 12px;
  - each card's pieces settle up 22px, card after card (0.12s apart).

  It resets out of sight, so a section replays its reveal when you come back to it. The vocabulary
  is two moves (rise out of a mask for type, settle up a few pixels for objects) and two eases
  (`expo.out` and `power3.out`). The hero keeps its typewriter.
- The canvas world is exempt from the arrival rule: it is the scene, not chrome. Launch-site effects (cloud shadows, dust,
  spindrift, plumes, flags, anemometer, beacons, birds) run only while their plate is on
  screen, draw at most about 400 particles at full density (scaled down by the low-power
  density), and all take their speed from the shared wind.
- Honour `prefers-reduced-motion`: no gust impulse, no translation at all. Site effects hold
  one still frame (beacons stay lit, no particles advect) and site switches are instant. Under
  reduced motion GSAP does nothing: no text is split or hidden, the launch note and picker just
  appear, and a site switch swaps the label in place. The station body's
  opacity tracks `--sweep` directly (`fade`) instead of a transform, and wind stays calm. The
  soft-sky crossfade is legibility, not motion, and stays on.

## 7. Depth

There is none in the chrome layer, deliberately. No `box-shadow`, no `border-radius`, no CSS
gradient on any instrument element. Separation comes from hairlines, ticks, tracking, and the
canvas behind — and, behind stations, the `--focus` crossfade to the softened sky.
`text-shadow` haloes are legibility tools over an unpredictable sky, not elevation — do not
repurpose them as glow effects.

**The card exception.** Cards (§5) are content surfaces, not chrome: 16px radius, hairline
frame, tinted covers with a bottom scrim. That is the whole allowance. No drop shadows, no
hover lift, no glass. If a card ever needs to feel higher, increase the soft-sky separation, do
not shadow it.
