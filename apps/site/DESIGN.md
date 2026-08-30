---
version: alpha
name: CoffeeJSON Site
description: "coffeejson.org — the landing page, the recipe and bean browser, the validator, the generator, and the QR share flow."
colors:
  primary: "#0c5964"
  on-primary: "#ffffff"
  surface: "#fdfdfc"
  on-surface: "#1a1a1a"
  muted: "#5b5b5b"
  line: "#d9d9d9"
  line-strong: "#8a8a8a"
  card: "#f7f6f4"
  error: "#a4262c"
  primary-dark: "#4cb6c2"
  on-primary-dark: "#10201c"
  surface-dark: "#141414"
  on-surface-dark: "#ececec"
  muted-dark: "#a3a3a3"
  line-dark: "#3a3a3a"
  line-strong-dark: "#6e6e6e"
  card-dark: "#1e1e1e"
  error-dark: "#ff8389"
typography:
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 16px
    lineHeight: 1.55
  h1:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 1.6rem
  h1-display:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 3rem
    lineHeight: 1.08
    letterSpacing: -0.02em
  lede:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 1.12rem
  h2:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 1.15rem
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 0.9em
rounded:
  sm: 8px
  md: 10px
  lg: 12px
  full: 999px
spacing:
  xs: 0.3rem
  sm: 0.6rem
  md: 0.9rem
  lg: 1.25rem
  xl: 4rem
motion:
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
  chip-on:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  qr-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  card-icon:
    size: 56px
---

# CoffeeJSON Site

## Overview

A small technical reference, not a marketing site. Plain system type, light structural
chrome, and one accent spent as *signal* — a link, a primary action, an active state —
never as a brand wash. The content is the page: a recipe, a JSON document, a validation
result. The design gets out of its way.

Light and dark are both first-class, switched by `prefers-color-scheme`. Every color
has a `-dark` twin chosen to hold equivalent contrast; in `styles.css` the two are one
custom property under a media query.

The landing page is the one surface that argues rather than does a job. It alone gets a
display `h1`, a lede, and a pulled `h2` at the three places the argument turns. Every
other page keeps its heading on the scale and has no lede.

## Colors

Nine roles. `styles.css` calls them `--accent --accent-fg --bg --fg --muted --line
--line-strong --card --error`, in that order.

- **Primary** (`colors.primary`) — a deep teal, blue-leaning on purpose: not the
  pine-and-grass green coffee retail defaults to, so the color reads as this format's
  own mark. Links, a filled button, the on-state of a toggle. AAA on the surface
  (7.85:1 light, 7.70:1 dark).
- **Surface** (`colors.surface`) — a hair off white: enough not to read as a synthetic
  sheet, not a cream canvas. The `theme-color` meta carries the same value.
- **Card** (`colors.card`) — a whisper warm. Everything else stays neutral gray.
- **Line** (`colors.line`) and **line-strong** (`colors.line-strong`) — a hairline that
  merely separates content may be faint (1.4:1; WCAG exempts it). A border that is the
  *only* thing saying "this is an input" or "this chip is off" must clear 3:1
  (SC 1.4.11). Decorative rules take `line`; anything the reader clicks or types into
  takes `line-strong`.
- **Muted** (`colors.muted`) — captions, metadata, step timestamps. 6.7:1.
- **Error** (`colors.error`) — validation errors, destructive state.
- **The mark** (`favicon.svg`) carries its own ink outside these roles — espresso
  `#241813`, cream `#F0E6E0` in dark — because it travels onto surfaces this site does
  not own. In running text it inherits `currentColor`, so two near-blacks never sit side
  by side.

## Typography

One native stack and no webfont: the format's whole pitch is plain data with no lock-in,
and the page renders in the reader's own OS face. JSON is set in a real monospace because
the format *is* JSON. Headings keep the browser's default bold; all display type is roman.

- (`typography.body`) everywhere.
- (`typography.h1`) on every tool page, where the heading gets out of the content's way.
  (`typography.h1-display`) on the landing page only — in the sheet it is
  `clamp(2.1rem, 6vw, 3rem)` — handing off to (`typography.lede`) held to a `42rem`
  measure. One lede per page, and only on a page that argues (`/`, `/showcase/`).
- (`typography.h2`). `.pull` is the same size with a `2.6rem` top margin, on the two or
  three headings that start a new movement. If every `h2` is pulled, none are.

## Layout

- One content column, `max-width: 52rem`, padded `1.25rem 1rem 4rem`. A page may have
  its own layout inside the column; it may not move the masthead.
- Card grids are `repeat(auto-fill, minmax(15rem, 1fr))`. A grid holding one or two
  items uses `auto-fit` capped at `24rem`, so a single card reads as a statement rather
  than a stub against empty tracks.
- The page never scrolls sideways. Wide content scrolls or wraps inside its own box;
  card titles and the display `h1` take `overflow-wrap: anywhere`, because both hold
  arbitrary transcribed text.
- Spacing is a loose rhythm — `xs`–`xl` are the values that recur — not a multiplier
  system.

## Elevation & Depth

None. A panel is told apart from the page by its fill and a hairline, never a shadow.

## Shapes

Small, restrained radii: (`rounded.sm`) on buttons, fields, banners and code blocks;
(`rounded.md`) on cards; (`rounded.lg`) on the QR panel; (`rounded.full`) on the chip toggle
alone. The one exception is an implementer's icon on `/showcase`: (`components.card-icon`)
with a 22% radius, the iOS mask, so a square export reads as the icon it is.

## Components

- **Masthead** — wordmark and five destinations in a fixed order (Browse · Showcase ·
  Implementations · Validator · Generate) over a 2px `on-surface` rule; the heavy rule is
  what makes it a masthead rather than chrome. The current page is bold with
  `aria-current`, not accent-colored. Brew-along strips it to the wordmark.
- **Button** (`components.button`); **ghost** (`components.button-ghost`) is a modifier on
  it with a primary border. Hover shades the fill 15% toward `on-surface`, instantly.
- **Chip** (`components.chip`, on-state `components.chip-on`) — facet filters and the
  Recipes/Beans lens, with a `line-strong` border at rest.
- **Field** (`components.field`) — `line-strong` border. Short inputs on `/generate` take
  their width caps from the sheet, never from inline styles.
- **Card** (`components.card`) — `line` border. Recipe and bean cards compose on it without
  new tokens. A bean card carries no action row: it is derived from documents rather than
  being one, so there is nothing honest to share.
- **Banner** — a 7% primary tint over `card` with a hairline mixed 45% toward primary.
  Not a colored left stripe: that shape reads as decoration whatever it marks.
- **Facts strip** — a `dl` of figures at `h1` size in tabular numerals with muted labels.
  Not a stat bar: no filled tiles, no display-size numbers, and every figure links to the
  page that proves it. The counts are derived at build time, never typed into copy.
- **Steps** — timestamp, instruction and cumulative water per row, hairline-separated.
  During brew-along the active step is the only one at full opacity.
- **Tables** — `line` borders, `card` fill on `thead` only, `overflow-x: auto`.
- **QR panel** (`components.qr-panel`) — an inline disclosure (`aria-expanded`,
  `aria-controls`), never a dialog.

## Do's and Don'ts

- **Do** spend primary as signal only: a link, one filled action, an on-state. Most of
  any page stays gray, white or near-black.
- **Don't** print a figure a click cannot verify.
- **Don't** give a tool page a lede or a display heading. A lede in front of a validator
  is a page clearing its throat.
- **Don't** add a motion system. State changes are instant. The one transition is the
  brew-along cross-fade — 0.2s on (`motion.ease-out`) — and it is removed under
  `prefers-reduced-motion`.
- **Don't** draw or fetch another product's mark. The only image a showcase card carries
  is the icon its implementer supplied in its own registry entry; cards are otherwise
  typographic.
- **Do** give every focusable element a 2px primary ring at 2px offset on
  `:focus-visible`. Upload buttons are labels around a visually-hidden input, never
  `hidden`.
- **Do** set `aria-busy` on any handler that awaits, and refuse re-entry while it is set.
