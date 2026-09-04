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
- A **field grid with crosshair ticks** at intersections, across the whole viewport.
- Links framed by a **hairline `::before` bracket** on hover instead of an underline.
- **Accent rationing** — chroma earns its place by scarcity, not by decoration.
- Flat chrome: zero border-radius, zero box-shadow on UI. (This site already did this.)

**Deliberately NOT taken:**
- The reference's fixed navy stage and viewport lock. This site's ascent — sky lightening
  to space via `--dark` — is a stronger idea than a static field, and a fixed viewport would
  destroy it. We keep the scroll.
- The reference's `normal` letter-spacing on display type. That rule exists because its
  display face is already tight; Inter is not, and set at 82px with `normal` tracking it
  reads loose. We keep a small negative tracking. **This is an intentional deviation.**
- Its acid `#c0fc04`. This site's accent is `--flare`, sampled from the balloon already on
  the canvas, and it belongs to the subject matter.

**Card stations (2026-09-04).** Projects, Experience and Education are full-width stations
whose card layouts follow two user-supplied references: rauno.me (horizontal rail of very large
cards with a typographic cover and a tick ruler) and adiprathapa.space (tinted photo cards with
logo / date / role / summary / tags; an education split of cover + text card). Those references
use rounded cards and per-card accent colours. **Both are adopted as a deliberate, bounded
exception** to the flat-instrument rules below — see §7. Cards are *content surfaces laid on the
sky*; the instrument chrome (HUD, tape, trace, ticks, rulers) stays square and flat.

The OpenAI marketing site was also requested as a reference; its capture is pending (the site
blocks headless capture and needs the Chrome extension). Type ramp and spacing may be retuned
once it lands, without changing any rule here.

## 1. Atmosphere & Identity

An instrument left running. The page is a radiosonde flight: you launch at a pale blue pad
and climb until the sky runs out. Nothing is a box — every section hangs off a single plotted
trace the way a temperature curve hangs off the pressure axis of a Skew-T, sitting directly
on the sky with only a haze behind it for legibility.

The signature is **live telemetry as structure**. The HUD reads ALT / TEMP / PRES / ASCENT /
PHASE off the actual physics simulation, not off a script — the numbers are true. The altitude
tape on the right is a real axis with real ticks, and each section sits at its own altitude.
The measurement frame is not decoration around the content; it *is* the navigation.

Depth is rejected on purpose. The chrome layer is hairlines, ticks, and type — no shadow, no
radius, no fill. All atmosphere lives in the canvas behind it: the sky gradient, the balloon,
the haze. That split is the architecture — **flat precise instrument in the DOM, lit world in
the canvas** — and it is why the UI never competes with the scene.

The world is two canvases. `#sky` carries the procedural atmosphere (five-stop gradient, horizon
haze band, brush-stamped cumulus, cirrus, sun, limb, stars) and is blurred and dimmed by
`--focus` whenever a text station is in view, so prose always sits on a soft ground. `#scene`
carries the balloon and near clouds and is never blurred. The balloon itself is a **photograph on
a soft body**: envelope, packed-chute bundle and sonde sprites are drawn over the Verlet ring,
the envelope clipped to the ring's real silhouette and deformed by a neck-frame affine fit, so a
grab still pinches it and pressure still bulges it.

Moving between stations is a **wind gust**. Entering a station fires one decaying horizontal
impulse through the wind path — the balloon leans right, the tether whips, the sonde trails —
while the canvas streaks spike and the station's cards sweep in from the right on the same
scroll-linked signal. The balloon then parks at a per-station home above the cards.

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
| Hairline | `--hair` | `--ink` @ 25% | Traces, rules, grid |
| Hairline strong | `--hair-strong` | `--ink` @ 64% | Section underlines, ticks |
| Grid | `--grid` | `--ink` @ 9% | Field grid lines |
| Grid tick | `--grid-tick` | `--ink` @ 30% | Crosshair marks |
| Sky | — | `#7ea7cd` | Body background under the canvas |
| Accent | `--flare` | `color-mix(in oklab, #d1521c, #f4a052, --dark)` | See rationing below |

Chrome that is on screen for the whole flight (`--chrome-*`) **steps** rather than blends —
it sits over an unpredictable sky and needs to stay legible, so it switches with `.sky-dark`
plus a stacked three-layer `--chrome-halo` glow.

### Rules
- Never introduce a colour outside this table. Extend the table first.
- No greyscale ramp. Hierarchy is `--ink` at three alphas, plus size and family.
- `--flare` is **rationed**. The complete permitted inventory:
  1. measurement marks — isobar bullets, the mission separator, the band altitude label,
  2. the organisation line in an entry,
  3. the PHASE readout in the HUD,
  4. **position markers on any axis** — the tape sled on the altitude axis and the current
     tick of a rail ruler (`.ruler__tick.is-current`),
  5. the global `:focus-visible` ring.
  It is **not** a link colour, **not** a hover colour, and **not** a text underline. Links use
  the bracket frame in §5; emphasis rules use `--hair-strong`. Adding a sixth job flattens
  the scheme — if you need one, remove another first.
- **Per-card `accent` is content, not palette.** A card may carry an `--accent` (from its data
  record) used only inside its cover slot: the experience/education tint and the fallback
  cover. It never colours text, chrome, borders or links. The paper stock and its local ink
  family (`--card-paper`, `--card-ink`) are fixed and do not follow `--dark`, because `--dark`
  saturates at 7 km while the sky is still blue and a card is a printed object, not sky.
- Depth is forbidden in the DOM: no `box-shadow`, no `border-radius`, no CSS gradient on UI,
  with **two documented exceptions**: `.tape__sled` carries a 12px `--flare` glow (a lamp on an
  instrument axis, not elevation), and **cards** (§5) carry a 16px radius, a hairline frame and,
  on tinted covers, a bottom-weighted scrim. Cards are content surfaces; do not use either as
  precedent for the chrome layer. `text-shadow` haloes exist for legibility over an
  unpredictable sky, not for depth.

## 3. Typography

Two families. One display, one data. Never a third.

- **Display / UI:** `Inter` (variable), `ui-sans-serif, system-ui, Helvetica Neue, Arial`.
- **Data / telemetry:** `Martian Mono` (variable, `wdth` 75–112), `ui-monospace, SFMono-Regular, Menlo`.

**Inter has no width axis.** The previous system built its hierarchy on Archivo's `wdth`
axis (7 display rules used `font-stretch`); those are all no-ops under Inter. Hierarchy is
therefore rebuilt on **size + weight + case + tracking**, and `font-stretch` must never appear
on a display-face rule again. It stays on `--data` rules, where Martian Mono's width axis is
real and load-bearing — condensing the data face to 76–88% is what makes a measurement read as
a measurement.

### Scale

| Level | Size | Weight | Line height | Tracking | Family | Usage |
|---|---|---|---|---|---|---|
| Nameplate | `clamp(34px, 6.6vw, 82px)` | 800 | **1** (solid) | −0.022em | display | `.hero__name`, uppercase |
| Section title | 15px | 700 | **1** (solid) | 0.2em | display | `.panel__title`, uppercase |
| Tagline | 16px | 400 | 1.5 | normal | display | `.hero__tagline` |
| Entry title | 15px | 650 | 1.25 | −0.005em | display | `.entry__title` |
| Entry org | 12.5px | 550 | 1.5 | normal | display | `.entry__org` |
| Body | 13px | 400 | 1.7 | normal | display | `.entry__text`, bullets |
| Small body | 12px | 400 | 1.8 | normal | display | `.hero__hint` |
| Eyebrow | 9.5px | 500 | — | 0.24em | data @78% | uppercase |
| Meta / dates | 9.5px | 400 | — | 0.12em | data @76% | uppercase, tabular |
| HUD key | 8.5px | 400 | — | 0.2em | data @76% | uppercase |
| HUD value | 11.5px | 500 | — | 0.06em | data @88% | tabular |

### Rules
- **Display type is set solid**: `line-height: 1` at nameplate and section title. Multi-line
  headlines lock into a typographic block. This is the single most important borrowed move.
- Weight carries what width used to: 800 nameplate → 700 title → 650 entry → 550 org → 400 body.
  Inter's variable axis makes 650/550 real values; do not round them to 600/500.
- Tracking is negative only at display sizes (−0.022em nameplate, −0.005em entry title) and
  positive only for uppercase data text. Body text is always `normal`.
- All measurements — altitudes, dates, pressures, layer names, tags — are set in `--data`,
  condensed, uppercase, `tabular-nums`. Prose is never set in the data face.
- Body never below 12px. HUD/label text may go smaller because it is uppercase and tracked.

## 4. Spacing & Layout

Base 4px. Layout tokens: `--gutter: clamp(20px, 5vw, 84px)`, `--panel-w: min(452px, 42vw)`,
`--tape-w: 210px`, `--tape-axis: 84px`, `--trace-gap: 26px`.

- The tape reserves a full column on the right; panels **and the hero** stop at its edge and
  never overlap it. Tape stop labels are `nowrap` and grow leftward from the right edge, so
  anything measured in `ch` must reserve `calc(100vw - --gutter - 108px)` below 900px. Inter's
  `ch` is ~10% wider than the previous display face — re-check this clearance if the display
  face ever changes again.
- Sections alternate left/right off the trace; the trace is continuous down the whole page.
- Breakpoints: 900px (tape narrows to 96px, wide HUD cells drop), 520px (trace gap tightens).

### Field grid
A fixed, non-interactive overlay behind all content: 4 columns × 3 rows of `--grid` hairlines
with 9px crosshair ticks in `--grid-tick` at every interior intersection. It sits above the
canvas and below `#content`, does not scroll, and is hidden under `prefers-reduced-motion`
only if it ever animates (it does not).

### Stations
Projects, Experience and Education are `.station` sections: full width minus the tape column
(`left: 0; right: var(--tape-w)`), positioned at their band altitude by the same layout as the
panels, height ≤ 0.82 viewport. A station is head (band annotation, solid-set title, lede ≤ 48ch,
ruler at the right) over a body: a horizontal `.rail` of cards, or the education split. Below
900px the tape collapses to labels and the rail dissolves under them with a mask over its last
104px. The balloon parks per station (`Band.homeX/homeY`, wide screens only): top-right for
Projects and Experience, top-left for Education, always above the card strip.

## 5. Components

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

### Panel
Hangs off the trace. Title is solid-set, uppercase, tracked, with a `--hair-strong` underline
and a tick crossing the trace. No background, no border, no radius.

### Entry
Title row (title left, date right in condensed data face), org line in `--flare`, prose,
then bullets whose markers are 8px isobar ticks — never dots.

### HUD
Fixed cells, data face, key over value, `tabular-nums` so digits do not jitter as they update.
PHASE is the only cell allowed the accent.

### Tape
Right-hand axis. Ticks, labels at major stops, a sled marking current altitude. Labels are
condensed data face with `--chrome-halo`.

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
- **Project card**: label row in the data face (index · title · year) above a cover, then body
  (description, tags, bracket links). The default cover is typographic — the title in the
  display face at up to 176px, weight 800, tracking −0.03em, set at the bottom-left and clipped by
  the card so it bleeds off the right edge.
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
  station presence) blurs and dims `#sky`; `--sweep` (an inheriting copy of `--in`) drives the
  station body's `translateX((1 − sweep) · 60vw)` and the per-card `--i · 8vw` stagger.
- **The gust** is physics, not CSS: one impulse of `GUST_PEAK` through the balloon's wind path,
  decaying with a 0.35s time constant, fired when a station's `--in` crosses 0.15 upward and
  re-armed below 0.05. It overshoots the parking point by ~100px and recovers in about a second.
- Motion must signal state. No decorative animation on non-interactive elements.
- Honour `prefers-reduced-motion`: no gust impulse, no sweep transform (fade only), calm wind.
  The blur is legibility, not motion, and stays on.

## 7. Depth

There is none in the chrome layer, deliberately. No `box-shadow`, no `border-radius`, no CSS
gradient on any instrument element. Separation comes from hairlines, ticks, tracking, and the
canvas behind — and, behind stations, the `--focus` blur of the sky itself.
`text-shadow` haloes are legibility tools over an unpredictable sky, not elevation — do not
repurpose them as glow effects.

**The card exception.** Cards (§5) are content surfaces, not chrome: 16px radius, hairline
frame, tinted covers with a bottom scrim. That is the whole allowance. No drop shadows, no
hover lift, no glass. If a card ever needs to feel higher, sharpen the sky blur behind it, do
not shadow it.
