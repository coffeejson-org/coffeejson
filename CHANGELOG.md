# Changelog

Changes to the CoffeeJSON **format** — the schema, the spec prose, and the
fixture corpus. The SDKs version independently
([Versioning & conformance](docs/spec/07-versioning.md#what-you-can-rely-on-today)).
The `coffeejson` version string tracks the format, and 1.x grows additively in
place ([Versioning](docs/spec/07-versioning.md)); layout follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Every measurement's `value`, `min` and `max` — and an origin's `items` —
  carries a `description` in the published schema. They state what the
  [Measurement object](docs/spec/03-recipe.md#measurement-object)'s own
  description does not: that `value` **excludes** `min` and `max` rather than
  merely differing from them, which until now was legible only from a
  `dependentSchemas` clause; that either bound stands alone, because an
  open-ended window is a thing a source really states and not half of a broken
  range; and that `items` is never an empty array, because absence is how "not
  published" is said. Annotation only — no keyword changed, and every document
  valid before is valid after.
- A conformance fixture for an **unknown value in an open registry**, carried
  by a document from a later minor. The corpus already covered unknown
  *members* and a later *version* separately; an unrecognized registry value is
  neither, and it is the case the
  [fallback rules](docs/spec/06-vocabularies.md) exist for — an unknown member
  is ignored, an unknown value in a closed enum is invalid, and an unknown
  value in an open registry is displayed.
- **`variant` on the [Gear object](docs/spec/03-recipe.md#gear-object)** — the
  maker's own designation for the instance, as printed: a size (`02`, `185`,
  `MDN-41`), a material, a generation. A registry entry names a product family;
  `variant` names which one of it, so `hario-v60` covers every V60 without the
  registry growing a row per size and generation. Free text, never an enum: the
  varying axis differs per family. Optional and additive — every document valid
  before is valid after.
- **`roles` on a [gear registry](docs/spec/06-vocabularies.md#gear-registry)
  entry**, saying where it attaches — `brewer`, `grinder`, `basket` — with
  `category` narrowed to how a brewer brews, and `pour-over-machine`, `drip` and
  `capsule` added to it. An all-in-one carries more than one role, which one
  member could not express. Registry data: nothing bumps.
- **Thirty-three gear entries and twenty-six varietals.** The gear baskets
  collapse from eight per-dose slugs to four families, the dose moving to
  `variant`. Every varietal entry now carries a `kind` and the `species` epithet
  it is sold as, both optional.

### Changed

- **A document that names registered gear omits `brand` and `model`.** The
  registry is authoritative for both, and a copy in the document only drifts
  from it. `label` keeps its own job — what the source itself called the thing,
  which is worth carrying when it wrote it in its own language. The strict
  authoring schema enforces the omission for registered ids and leaves it alone
  for an id the registry does not carry, which still needs the fallback.
- **`gearLabel` in `@coffeejson/core` resolves a known id** against the
  registry's own labels and renders `variant` beside it, rather than reading the
  display string off the document. The bundled map is keyed by language tag.

### Fixed

- **The [gear registry](docs/spec/06-vocabularies.md#gear-registry) chapter
  contradicted itself.** Its granularity rule told a producer to put a size in
  `model`; its matching rule three paragraphs later said `model` is the fallback
  for `custom` and unrecognized ids only — so a stated size was written into the
  one member a conformant consumer would not read. Both now say `variant`.

- The **authoring schema** admits the reserved
  [`ext`](docs/spec/07-versioning.md#reserved-extensions) member on every entity
  it defines. It closed every object without exempting it, so a document
  carrying vendor data failed the producer lint with the error a typo produces.
  A [localization](docs/spec/03-recipe.md#localizations) is the exception and
  still refuses it: an overlay carries wording, and `ext` is not wording. The
  member must be an object with non-empty keys — the shape the reservation
  states — while its contents stay unconstrained. The runtime conformance
  schema is unchanged.

## [1.0] — 2026-08-29

The initial published format: document envelope, recipes, beans, tastings, the
shared vocabularies, and the transport binding.

### Added

- **Recipes** — quantities with explicit canonical units, dose:yield `basis`,
  ordered steps with typed kinds, structured grind, gear references, and
  attribution (`author`, `based_on`).
- **Beans** — roaster as a party, origin items, process, roast level, altitude.
- **Tastings** — a brewed cup's attributed impression and measured reading.
- **Envelope** — a `coffeejson` version string with top-level `recipes[]`,
  `beans[]`, and `tastings[]`, referenced by id.
- **Espresso** ships whole on a dose:yield basis; the *dynamic* pressure/flow
  layer is reserved.
- **Vocabularies** are tiered — closed where the value set is finite, open with
  a fallback where it is not.
- **Transport** — a document carried in a URL or QR code as unpadded base64url,
  plain or zlib-compressed.
- **JSON-LD export** — a documented mapping to schema.org/Recipe that emits only
  what the document says.
