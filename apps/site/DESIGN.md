---
version: alpha
name: CoffeeJSON Site
description: "coffeejson.org — the landing page, the recipe and bean browser, the validator, the generator, and the QR share flow."
colors:
  primary: "#085a66"
  on-primary: "#fbf8f3"
  surface: "#f4efe7"
  on-surface: "#281a14"
  muted: "#645850"
  line: "#dad3ca"
  line-strong: "#897e74"
  card: "#fcf9f3"
  sunk: "#ede7de"
  error: "#9b1e22"
  coffee: "#5a3a28"
  coffee-dark: "#a7836a"
  primary-dark: "#64c2cc"
  on-primary-dark: "#061416"
  surface-dark: "#150f0c"
  on-surface-dark: "#ece2db"
  muted-dark: "#b2a59b"
  line-dark: "#362f2b"
  line-strong-dark: "#7d726b"
  card-dark: "#1f1814"
  sunk-dark: "#0e0907"
  error-dark: "#fe8a88"
typography:
  body:
    fontFamily: '"Bricolage Grotesque Variable", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 17px
    lineHeight: 1.6
  h1:
    fontFamily: '"Bricolage Grotesque Variable", "Arial Narrow", system-ui, sans-serif'
    fontSize: 3.5rem
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: -0.025em
  h1-display:
    fontFamily: '"Bricolage Grotesque Variable", "Arial Narrow", system-ui, sans-serif'
    fontSize: 5.6rem
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: -0.03em
  lede:
    fontFamily: '"Bricolage Grotesque Variable", system-ui, -apple-system, "Segoe UI", sans-serif'
    fontSize: 1.25rem
  h2:
    fontFamily: '"Bricolage Grotesque Variable", "Arial Narrow", system-ui, sans-serif'
    fontSize: 1.75rem
    fontWeight: 600
  code:
    fontFamily: '"Commit Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
    fontSize: 0.88em
rounded:
  sm: 6px
  md: 12px
  lg: 18px
  full: 999px
spacing:
  xs: 0.5rem
  sm: 0.75rem
  md: 1rem
  lg: 1.5rem
  xl: 2.5rem
  2xl: 4rem
motion:
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-in: "cubic-bezier(0.7, 0, 0.84, 0)"
  ease-in-out: "cubic-bezier(0.65, 0, 0.35, 1)"
  micro: 120ms
  short: 240ms
  long: 600ms
components:
  button:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
  chip:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    rounded: "{rounded.full}"
  chip-on:
    backgroundColor: "{colors.on-surface}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
  live-document:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
  card-icon:
    size: 56px
---

# CoffeeJSON Site

## Overview

The format's claim is that a recipe arrives as numbers. The site shows it: a recipe's
timed pours are plotted as a **pour curve** — cumulative water against time — and that
shape appears wherever a recipe does. Nothing on the site moves or is drawn unless a
document drives it: the rule for figures, extended to pictures and motion.

Warm paper, espresso ink, one teal spent as signal. One grotesque for headings and
prose, and a monospace for every quantity.

Light and dark are both first-class, switched by `prefers-color-scheme`. Every color
has a dark twin chosen to hold equivalent contrast; in `styles.css` the two are one
custom property under a media query, written in OKLCH. The hex values above are their
sRGB equivalents, and the `theme-color` meta carries the surface pair.

The landing page is the one surface that argues rather than does a job. It alone gets a
display `h1`, a lede, and the live document. Every other page keeps its heading on the
page scale.

## Colors

`styles.css` calls the roles `--bg --card --sunk --fg --muted --line --line-strong
--accent --accent-fg --error`, plus `--water` and `--water-fill` for the curve.

- **Surface** (`colors.surface`) — paper, tinted toward the ink's own hue. **Card**
  (`colors.card`) is one step lighter and is what a panel sits on; **sunk**
  (`colors.sunk`) is one step darker and holds code.
- **Ink** (`colors.on-surface`) — the mark's own espresso, so the logo and the text
  beside it are one color. It is also the fill of a primary button and an on-state chip.
- **Primary** (`colors.primary`) — a deep teal, blue-leaning on purpose: not the
  pine-and-grass green coffee retail defaults to. Links, the focus ring, numbers in a
  JSON listing, and **water** — the curve's stroke and its 16% fill. Never a button
  fill, never a section background. AAA on the surface in both schemes.
- **Line** (`colors.line`) and **line-strong** (`colors.line-strong`) — a hairline that
  merely separates content may be faint (WCAG exempts it). A border that is the *only*
  thing saying "this is an input" or "this chip is off" must clear 3:1 (SC 1.4.11):
  3.47:1 light, 4.06:1 dark.
- **Muted** (`colors.muted`) — captions, metadata, step timestamps. 6.0:1 or better on
  every surface it sits on.
- **Coffee** (`colors.coffee`) — the other half of a ratio. A data color only: the
  coffee's share of a ratio bar, and (as a light-to-dark ramp) the cells of a roast
  mark. Never text, never chrome.
- **Error** (`colors.error`) — validation errors, destructive state.
- A QR code's ground stays light in both schemes: it is scanned, not read.

## Typography

Two faces, each with a job.

- **Bricolage Grotesque** (`typography.h1`, `typography.h1-display`, `typography.h2`,
  `typography.body`) — variable, with optical sizing on, so one family carries a 90px
  headline and 17px prose. Headings are always roman: emphasis inside a heading is
  carried by weight, never by italics.
- **Commit Mono** (`typography.code`) — one weight. JSON, and **every measured value**:
  doses, ratios, temperatures, clocks, step times, the facts strip. A quantity is always
  mono with tabular figures. It has no bold; emphasis in mono is color.

Both webfonts are self-hosted from dev dependencies, Latin subset, `font-display: swap`.
The page fetches nothing from a third party.

Sizes are fluid `clamp()` steps. `typography.h1-display` is the landing page's alone and
runs from 2.9rem to 6rem, sized so the headline and the live document share the first
screen; `typography.h1` is every other page's title. One lede per
page, and only on a page that argues (`/`, `/showcase/`).

## Layout

- One shell, `max-width: 76rem`, shared by every page, so the masthead never moves
  between them. Prose keeps a `42rem` measure inside it; grids, figures and tools opt
  out with their own widths.
- The landing page opens with the headline and pitch over the live document at full
  width — the curve is the page, not a widget in it — all inside the first screen, then runs as full-width movements separated by hairlines. A section's
  heading stacks over its content or sits beside it; no section carries a numbered
  eyebrow.
- A directory is grouped by who made the thing — one section per author or roaster,
  its count beside the name. Both are indexes, not card grids: a recipe is a row — its
  curve, its name and source, four figures in columns that line up down the page, one
  action, and the whole row is the link — and a bag is a line. Bags are drawn one way,
  by one function, under one title and intro, on the bags hub and in the directory's
  bag lens; the Recipes/Bags toggle sits above the title on both so it never moves. What a reader does
  with a recipe or a bag (QR, copy, download) lives on its page.
- A recipe page with a schedule is two columns: the curve and its steps, and beside
  them what the recipe is, how to take it, and where it came from.
- Card grids are `repeat(auto-fill, minmax(19rem, 1fr))`. A grid holding one or two
  items uses `auto-fit` capped at `26rem`.
- Where a grid of identical cards would say less than a list, use the ruled **ledger**:
  a term and what it means, one row each.
- The page never scrolls sideways. Wide content scrolls or wraps inside its own box;
  headings take `overflow-wrap: anywhere`, because they hold arbitrary transcribed text.
- Spacing is a named 4-point scale (`--space-3xs` … `--space-4xl`).

## Elevation & Depth

A panel is told apart from the page by its tone and a hairline. One object carries a
shadow: the landing page's live document, the only thing meant to sit above the page.
In the dark scheme it has none — on a dark ground depth is lightness, never a halo.

## Shapes

(`rounded.full`) on buttons, chips and the search field; (`rounded.sm`) on inputs;
(`rounded.md`) on cards, code blocks and banners; (`rounded.lg`) on the live document.
The one exception is an implementer's icon on `/showcase`: (`components.card-icon`)
with a 22% radius, the iOS mask.

## Components

- **Masthead** — the mark, the wordmark, and five destinations in a fixed order
  (Browse · Showcase · Implementations · Validator · Generate), with GitHub set apart at
  the end, over a 2px ink rule. The current page is underlined, with `aria-current` —
  never heavier, because a wider word would shift every link after it between pages. A
  recipe or bag page marks Browse as its section. Below `46rem` the destinations take a
  row of their own and GitHub stays beside the wordmark. Brew-along strips it to the
  wordmark.
- **Footer** — a 2px ink rule, the links row (Home · Browse · Showcase · Spec ·
  For AI agents · GitHub), then the license line. The same on every page; only
  `footer.mjs` builds it.
- **Pour curve** — a staircase in a box that stretches to any width, with HTML labels
  placed by percentage so text never stretches with it. `--p` (0–1) is how much of the
  brew has happened: it starts at 1, so the figure is complete with no script. The
  playhead is the leading edge of the water and stands only as high as the water does,
  so it never crosses a label. When every point has room for its weight, every point is
  labeled; when any does not, only the first and last are — the step list carries every
  number. Room is judged twice, for a plot as wide as a column and for one as narrow as
  a phone, and a label that fits only the first is hidden in the second. In the live
  document the pour being played or edited wears its weight as a tag. Three
  sizes: the **sparkline** on a directory row, the **figure** on a recipe page and in the viewer,
  and the **live document** on the landing page. A recipe with no timed pours gets a
  **ratio bar** at full size on its page, with both sides named, and on its row its two
  **weights** (where it states a single dose; a window names no one weight, and gets no
  glyph): a block of coffee beside a block of water, each drawn as the face of a
  cube holding that many grams, so its side grows with the cube root — the weights span
  two orders of magnitude, and as lengths or areas most of them would be a speck. In the directory and on the landing page's **wall** every glyph is drawn to
  one scale — the longest brew wide, the largest tall — so they can be compared: a short
  brew is a short curve, an espresso two small squares. A row's curve redraws under the
  pointer.
- **Overlay** — at the head of the recipe directory, every schedule in the filtered set
  on one pair of axes: a line per recipe, minutes along, water up. A line is quiet
  until its row or the pointer picks it out, and the two light together.
- **Origin strip** — a blend's components as segments, as wide as their shares. Drawn
  only when the roaster states every share: equal segments for unstated shares would
  read as a measured split.
- **Conformance cells** — on `/implementations`, one cell per fixture and scan vector,
  in two named rows: water-colored for a case to accept, coffee-colored for one to
  refuse. Both solid — a case to refuse is not an unfinished one. Each is a link to its
  case, kept out of the tab order; the prose beside them links both corpora.
- **Carriers** — on the landing page, one document three ways: its file, its share
  link, and that link as a QR drawn at build time. Three columns of one ruled strip
  rather than three boxes, because the artifacts are different heights.
- **Roast mark** — one cell per level the vocabulary has, filled up to the bag's. Not
  drawn for a level the vocabulary does not know.
- **Ledger** — a ruled list, a term and what it means per row. On `/showcase` each row
  carries a small drawing of the carrier, and every drawing holds the same staircase.
- **Live document** (`components.live-document`) — one corpus file, verbatim, beside
  everything it says: the curve, a clock, the water so far. It plays once on first view,
  can be paused and scrubbed, and stops; releasing an edited pour plays the edit back. The line of the file being poured is lit. And
  it edits: a pour is a slider (drag, or arrow keys), bounded by its neighbors because
  cumulative water never decreases, and moving one rewrites its line of the file and
  the share link under it. Reset restores the published recipe.
- **Button** (`components.button`) is ink-filled; **ghost** (`components.button-ghost`)
  has a `line-strong` border. On a card the secondary actions drop the border and read
  as words.
- **Chip** (`components.chip`, on-state `components.chip-on`) — facet filters and the
  Recipes/Bags lens. A filter chip carries the count it would show beside the other
  filters in force, and is disabled when that is none: a click never leads to an empty
  list.
- **Field** (`components.field`) — `line-strong` border. Short inputs on `/generate`
  take their width caps from the sheet, never from inline styles.
- **Card** (`components.card`) — `line` border. An implementer on `/showcase` and a
  panel on `/generate`.
- **Banner** — a tint of primary over `card` with a hairline mixed toward primary. Not
  a colored left stripe: that shape reads as decoration whatever it marks.
- **Facts strip** — a `dl` of large mono figures with muted labels under a 2px rule.
  Every figure links to the page that proves it, and the counts are derived at build
  time, never typed into copy.
- **Steps** — timestamp, instruction and cumulative water per row, hairline-separated.
  During brew-along the active step is the only one at full opacity.
- **Tables** — hairline rows, a muted header row, `overflow-x: auto`.
- **QR panel** — an inline disclosure (`aria-expanded`, `aria-controls`), never a
  dialog.

## Motion

Three durations (`motion.micro`, `motion.short`, `motion.long`) and three curves. Only
`transform`, `opacity`, color and `--p` animate.

- **State** — hover, press, toggle: `motion.micro`. A focus ring never transitions; it
  is there at once.
- **Entrance** — one, on the landing page: the hero's parts rise in sequence, done
  inside a second. Nothing else fades in on scroll.
- **Draw** — a recipe page's curve draws once on arrival. Below the landing page's hero
  the wall's curves and the closing staircase draw when they are scrolled to — once, on
  a clock, so a reader who stops scrolling never sees one half-drawn.
- **Playback** — the live document, and brew-along's playhead at true speed.
- **Page transitions** — cross-document view transitions: the masthead holds still and
  the page cross-fades under it. No element morphs between pages: a title that changes
  size mid-flight reads as two titles at once.
- **Hover** — a recipe row's curve redraws; an editable pour is ringed.

Under `prefers-reduced-motion: reduce` the three duration tokens collapse to 1ms, the
entrance, the draw and the page transitions are not declared at all, and the live
document does not autoplay — it rests on its last frame, and the scrubber still works.

## Do's and Don'ts

- **Do** spend primary as signal only: a link, a focus ring, water. Most of any page is
  paper and ink.
- **Do** set every measured value in mono.
- **Don't** print a figure a click cannot verify, or draw a curve a document did not
  state. A recipe with too little timing to plot gets the ratio bar, not a guess.
- **Don't** loop an animation. The live document plays once.
- **Don't** end a line on a separator. Figures are set apart by space, each one
  unbreakable.
- **Don't** give a tool page a lede. A lede in front of a validator is a page clearing
  its throat.
- **Don't** draw or fetch another product's mark, and don't draw fake device or browser
  chrome around anything. The only image a showcase card carries is the icon its
  implementer supplied in its own registry entry.
- **Don't** number or label sections with eyebrows.
- **Do** give every focusable element a 2px primary ring at 2px offset on
  `:focus-visible`. Upload buttons are labels around a visually-hidden input, never
  `hidden`.
- **Do** set `aria-busy` on any handler that awaits, and refuse re-entry while it is set.
