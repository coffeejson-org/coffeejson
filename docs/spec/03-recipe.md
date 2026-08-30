# Recipe

A **Recipe** describes the parameters of a brew. It is the primary entity of
CoffeeJSON v1.0. It and the [Bean](04-bean.md) are the two co-equal entities at
the top level of a [document](02-envelope.md), each carried in its own array
(`recipes`, `beans`). A [Tasting](05-tasting.md) evaluates a brew of one and is
carried in a third.

```json
{
  "title": "Sunday V60",
  "method": "pour_over",
  "brewer": { "id": "hario-v60", "brand": "Hario", "model": "V60", "label": "Hario V60" },
  "coffee": { "value": 15,  "unit": "gram" },
  "water":  { "value": 250, "unit": "gram" },
  "ratio": 16.7,
  "water_temp": { "value": 94, "unit": "celsius" },
  "grind": { "grinder": { "id": "comandante-c40", "label": "Comandante C40" }, "setting": "22 clicks" },
  "steps": [ /* … */ ],
  "finish_s": 150
}
```

## Fields

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `id` | string | no | Document-local name for this recipe, so one of several can be addressed. See [`id`](#id). |
| `title` | string | yes | Human text, as written by the author. Never empty. Language hinted by `lang`. |
| `description` | string | no | One- or two-sentence summary — the preview/snippet text. Distinct from `notes`. Human text — see `lang`. See [`description`](#description). |
| `method` | string (enum) | no | Brewing **technique** — see [`method` vocabulary](#method-vocabulary). Omit if unknown. |
| `basis` | string (enum) | no | Which quantity the recipe is stated in: `water` (default when absent — requires `water` or `ratio`) · `yield` (requires `yield`, forbids `water`/`ratio`). The structural switch; `method` stays descriptive. See [Espresso (dose : yield)](#espresso-dose--yield) and [Vocabularies § `basis`](06-vocabularies.md#basis). |
| `brewer` | [Gear](#gear-object) | no | The **device** (V60, Origami, AeroPress…). Omit if unknown. |
| `coffee` | [Measurement](#measurement-object) | yes | Coffee **dose** (mass). Recommended unit `gram`. |
| `water` | [Measurement](#measurement-object) | cond.¹ | Total brew water. Recommended unit `gram`. Present on a water-basis recipe (`basis:"water"`, or absent — the default); not on a yield-basis recipe. |
| `yield` | [Measurement](#measurement-object) | cond.¹ | Beverage mass **out**, in the cup — the beverage a brew produces, meaningful for any method (distinct from input `water`). REQUIRED when `basis` is `yield`; optional otherwise. |
| `ratio` | number | cond.¹ | Water-to-coffee ratio (dimensionless, for example `16.7`). See [Ratio](#ratio). |
| `water_temp` | [Measurement](#measurement-object) | no | Brew-water temperature. Recommended unit `celsius`. |
| `grind` | [Grind](#grind-object) | no | Structured grind specification. |
| `pressure` | [Measurement](#measurement-object) | no | Nominal peak brew pressure. Recommended unit `bar`. See [Espresso](#espresso-dose--yield). |
| `preinfusion_s` | number | no | Seconds of low-pressure pre-wetting before full pressure. |
| `basket` | [Gear](#gear-object) | no | The filter **basket** (espresso) — for example an 18 g precision basket. |
| `filter` | [Filter](#filter-object) | no | The brew filter — what the water passes through. See [Filter](#filter-object). |
| `steps` | array of [Step](#step-object) | no | Ordered, typed brew steps. Omit or empty for a recipe with no step guide. |
| `finish_s` | number | no | Seconds from start to the cue to draw down / remove the brewer — for `espresso`, the target **shot time**. |
| `lang` | string (BCP-47) | no | Language of the human text fields (`title`, custom labels), as a well-formed BCP-47 tag — `en`, `en-US`, `zh-Hant-TW`; hyphen-separated, so `en_US` is **invalid**. A hint only. |
| `author` | [Party](#party-object) | no | Who authored this recipe — a person or organization. See [Attribution](#attribution-author-based_on). |
| `based_on` | string (URI) | no | Where this recipe was originally published, for a transcribed recipe. See [Attribution](#attribution-author-based_on). |
| `images` | array of string (URI) | no | Image URLs for the recipe/brew. Always an array; omit or empty when none. See [Images & publication date](#images--publication-date). |
| `date_published` | string (ISO 8601 date) | no | When this recipe was first published. See [Images & publication date](#images--publication-date). |
| `bean_ref` | string | no | The [`id`](04-bean.md#id) of the bean in this document that this recipe is for. See [`bean_ref`](#bean_ref). |
| `recommended` | boolean | no | `true` marks this recipe as the producer's recommended brew. Omit rather than emit `false`. See [`recommended`](#recommended). |
| `notes` | string | no | Free-text prose about the whole recipe (character, tips, troubleshooting). Human text — see `lang`. See [`notes`](#notes). |
| `additions` | array of [Addition](#addition-object) | no | Liquids added beyond the brew `water` — ice, milk, sugar, syrup, and more. See [Additions](#additions). |
| `localizations` | object | no | The publisher's own translations of this recipe's human text, keyed by BCP-47 tag. Requires `lang`. See [Localizations](#localizations). |

¹ The stated brew quantity switches with `basis`. See
[Espresso (dose : yield)](#espresso-dose--yield). A water-basis recipe
(`basis:"water"`, or absent, the default) REQUIRES **`water` or `ratio`**, and
MAY add `yield`. A `basis:"yield"` recipe REQUIRES `yield` and **MUST NOT**
carry `water` or `ratio`.

`coffee` is always required, so `water` and `ratio` each fix the other. One of
them is enough. Recipes are commonly published as a dose and a ratio ("20 g at
1:15") with no total printed. A required `water` would force a producer to
compute and assert a figure the source never gave. A consumer that needs the
total when only `ratio` is stated derives it as `coffee × ratio`. A producer
that knows both SHOULD state both.

`coffee` is the **dose**, the mass of coffee. The coffee's *identity* (where it
is from, how it is processed) lives in the top-level [Bean](04-bean.md) entity,
never in the recipe.

### Ratio

`ratio` is the water-to-coffee ratio as a bare dimensionless number (water ÷
coffee by mass), for example `16.7` for a 1:16.7 brew.

- If `ratio` is omitted, a consumer computes it from `water` / `coffee`. Both
  operands come to one mass unit — grams — before they divide, so 15 g of
  coffee to 8 oz of water is 1:15.1 and never 1:0.5. An operand stated by
  volume, or in a unit the consumer does not recognize, yields **no** ratio,
  and a window is reduced only under [Stated windows](#stated-windows).
- If `ratio` is present but inconsistent with `coffee` and `water`, a consumer
  **SHOULD** prefer the explicit `coffee` / `water` measurements and **MAY**
  recompute `ratio`. The measurements are authoritative. The ratio is a
  convenience.

`ratio` describes `water`, so it never appears on a yield-basis recipe. See the
next section.

Two further rules follow from what `ratio` is:

- **It is a mass ratio, so it is absent when `water` is a volume.** A recipe
  that states 13 g of coffee to 225 mL of water states no mass ratio. The
  format does not compute one, because that needs the density conversion
  [Water quantity](#water-quantity) declines to define. A consumer that shows
  "1:17" there is showing its own arithmetic.
- **It is often what couples two windows.** A French press guide can state
  25–45 g of coffee to 375–675 g of water, because the recipe scales with the
  press. When both are [windows](#stated-windows), the single ratio of 15
  holds across the range. `ratio` is the only field that says so. Emit it.

### Scaling

A consumer that lets the user brew a recipe at a different batch size
**SHOULD** scale by multiplying every mass by one factor: `coffee`, `water`
(or `yield`), each addition's `amount`, and each step's cumulative `to_water`.
`ratio` is a mass quotient, so it stays invariant. Nothing else scales.
Timings (`at_s`, `action_duration_s`, `finish_s`), `water_temp`, `grind`, and
`pressure` are the author's technique, not functions of batch size, and the
format defines no rule for them. A consumer that re-times a scaled brew applies
its own brewing model. It **MUST NOT** present the result as the author's
schedule. A scaled document is a re-authored one. Emit the scaled masses as
ordinary values. There is no scale-factor field.

### Espresso (dose : yield)

`basis: "yield"` switches the recipe's stated brew quantity. An espresso recipe
sets it, because espresso states what lands **in the cup**, not the water that
goes in. The puck retains roughly twice its dry mass, and no espresso recipe
states input water.

- `coffee` remains the **dose** in, and `yield` is **REQUIRED**: the beverage
  mass out, for example 19 g in → 47 g out.
- `water` and `ratio` **MUST NOT** be present. Their definitions (total brew
  water, water ÷ coffee) have nothing true to say about a shot, and the
  [schema](../schema/coffeejson-1.0.schema.json) rejects them. A yield can
  never masquerade as water.
- A consumer shows the espresso ratio as **dose : beverage**, derived from the
  measurements. 19 g → 47 g reads as 1 : 2.5 (`yield ÷ coffee`).
- `finish_s` is the target **shot time**. `water_temp` is the brew temperature,
  as for any method.
- `pressure` (nominal peak, recommended unit `bar`), `preinfusion_s` (seconds
  of low-pressure pre-wetting), and `basket` (a [Gear](#gear-object) for the
  filter basket) complete the shot's parameters. The espresso *machine* is the
  recipe's `brewer`, as usual.
- The espresso step kinds are `distribute` (WDT), `tamp`, and `pull`. See
  [Step](#step-object). The shot's numbers live at the recipe level. A `pull`
  step carries instructions, never measurements.

```json
{
  "coffeejson": "1.0",
  "recipes": [
    {
      "title": "Roaster's espresso",
      "method": "espresso",
      "basis": "yield",
      "coffee": { "value": 19, "unit": "gram" },
      "yield":  { "value": 47, "unit": "gram" },
      "water_temp": { "value": 93, "unit": "celsius" },
      "pressure": { "value": 9, "unit": "bar" },
      "preinfusion_s": 3.5,
      "finish_s": 26.5,
      "steps": [
        { "kind": "distribute", "instruction": "WDT, level the bed" },
        { "kind": "tamp" },
        { "kind": "pull", "instruction": "line pressure to 3.5 s, then 9 bar" }
      ]
    }
  ]
}
```

For every **water-basis** recipe (the default) the model is unchanged. `water`
is required, and `yield` MAY also state the beverage mass out. `yield` is the
same universal quantity, not an espresso-specific field: a filter brew's output
is its water minus what the bed retains. A yield-basis recipe is the one that
*requires* `yield`, because it alone has no input-water figure to state.
Espresso is the motivating case.

Multi-phase pressure / flow **profiles**, a named machine-executable curve
(Decent-style shot files, Fellow Aiden profiles), are not modeled in v1.0. A
producer describes phases in step `instruction` text. Structured profiling is
reserved by name in [Versioning § Reserved
extensions](07-versioning.md#reserved-extensions).

### Localizations

A document is written in one language, named by [`lang`](#fields). Some
publishers write in two. A roaster prints a Japanese bag and its own English
beside it. A barista publishes a method in their language and in English.
`localizations` carries those, keyed by BCP-47 tag:

```json
{
  "title": "4:6メソッド",
  "lang": "ja",
  "coffee": { "value": 20,  "unit": "gram" },
  "water":  { "value": 300, "unit": "gram" },
  "steps": [
    { "at_s": 0,  "to_water": { "value": 60,  "unit": "gram" }, "instruction": "1投目 — 甘さを決める" },
    { "at_s": 90, "to_water": { "value": 300, "unit": "gram" }, "instruction": "2投目 — 濃度を決める" }
  ],
  "localizations": {
    "en": {
      "title": "4:6 Method",
      "steps": [
        { "instruction": "first pour — sets sweetness" },
        { "instruction": "second pour — sets strength" }
      ]
    }
  }
}
```

**Only wording varies.** A localization carries `title`, `description`,
`notes`, and per-step `instruction` / `label`, and nothing else. Every
quantity, unit, enum, piece of gear, and reference belongs to the recipe
itself and is the same in every language. A translation that changed a dose
would be a *different recipe* with a language tag. The [authoring
schema](../schema/coffeejson-1.0.authoring.schema.json) rejects any other
member. The runtime schema is open like every other object here, so a future
minor can add a text field.

**`lang` is required when `localizations` is present.** An overlay overrides a
base, so the base's language has to be stated. Otherwise nothing says what is
translated *from*. The schema enforces this.

**Step wording is positional.** Entry *i* of a localization's `steps`
translates step *i*. An empty object `{}` leaves that step untranslated, which
is how a publisher who translated two of four steps says so. The array
**MUST** be the same length as the base `steps`. On any other length a
consumer **MUST** ignore the whole array rather than pair an instruction with
the wrong pour. A misaligned instruction is worse than an untranslated one,
because it is confidently wrong. A validator **SHOULD** warn. JSON Schema
cannot express length equality, so this is a semantic rule.

**Only the publisher's own translation belongs here.** This is the same rule
that governs the rest of the format: a document states what its source stated.
A consumer or transcriber that translates text itself is *authoring*. It makes
word choices the publisher never made, and placing them in the publisher's
document does not make them the publisher's words. An application can
translate for display. It must not write the result back into
`localizations` and re-share it.

**Matching.** A consumer that chooses a locale **SHOULD** use BCP-47 lookup
([RFC 4647](https://www.rfc-editor.org/rfc/rfc4647) §3.4) rather than exact
string equality. Then a request for `en-US` is satisfied by an `en` overlay.
With no match it renders the base fields. A consumer that ignores
`localizations` entirely does the same, so the field costs nothing to skip.

### Attribution (`author`, `based_on`)

`author` credits **who devised the recipe**: a person or organization, in the
[Party](#party-object) shape (`{ name, url? }`). It travels inside the document
itself, not as an out-of-document sidecar. Attribution must survive a
re-share. Once a recipe is copied between apps or pasted into a share URL,
only what the JSON carries is still attached to it.

`based_on` cites **where the recipe was originally published**: a URL, for a
recipe transcribed from a roaster's brew guide, a competition write-up, or a
video. Unlike `author`, it names a *publication*, not a person or
organization. So it is a bare `string` in `format: uri`, not a `Party`.

Three provenance surfaces answer three different questions, and none stands in
for another. `author` is *who devised it*. `based_on` is *where it was first
published*. The envelope's [`generator`](02-envelope.md#generator) is *what
software wrote this file*, informational only. The first two vary from recipe
to recipe, so they live on the Recipe. `generator` cannot vary within a
document, so it lives on the envelope. One document can carry all three: a
recipe authored by a competition barista, based on the write-up where they
published it, exported by whatever app wrote this copy.

### Images & publication date

`images` carries **absolute image URLs** for the recipe: the resulting brew,
the method in progress. It is always an array. A single image is an array of
one, and an empty array is equivalent to absent, like the other optional
arrays. The URLs are reference metadata. A consumer can render, proxy, or
ignore them, and nothing else in the document depends on them.

`date_published` is the ISO 8601 calendar date the recipe was **first
published**. It is publication metadata about the recipe as a work. It is
distinct from the coffee's [`roast_date`](04-bean.md) and from
[`based_on`](#attribution-author-based_on) (*where* it was published).

Together these map to schema.org `image` and `datePublished`. With the
recipe's name, they are the properties search-engine rich results require.

```json
{
  "coffeejson": "1.0",
  "recipes": [
    {
      "title": "4:6 Method",
      "method": "pour_over",
      "coffee": { "value": 20, "unit": "gram" },
      "water": { "value": 300, "unit": "gram" },
      "author": { "name": "Tetsu Kasuya", "url": "https://en.philocoffea.com" },
      "based_on": "https://en.philocoffea.com/blogs/blog/coffee-brewing-method"
    }
  ]
}
```

- **Distinct from `author.url`.** `author.url` is the author's own page (a
  profile, a site, a channel). `based_on` is the specific place *this recipe*
  was published. That can be a different page on the same site, as above, or
  somewhere else entirely (a video, a third party's write-up of a competition
  routine).
- **Distinct from [`generator`](02-envelope.md#generator).** `generator`
  records what *software* emitted the JSON. It is informational, a property
  of the whole document rather than of any one recipe. A consumer
  **MUST NOT** depend on it. `based_on` records where the *recipe* was first
  published, regardless of which app later transcribed or exported it. See
  [Attribution](#attribution-author-based_on) for how the three surfaces
  relate.
- **Licensing is not a per-recipe field.** It is handled at the corpus level,
  with a repository `LICENSE` plus a page declaration. It is not attached to
  individual recipe documents.
- For structured-data consumers: `author` maps to schema.org's
  [`author`](https://schema.org/author) (`Person` or `Organization`), and
  `based_on` maps to schema.org's [`isBasedOn`](https://schema.org/isBasedOn).

### `id`

`id` is a **document-local name for one recipe**, so that something outside
the `recipes` array can say *which* one it means. It is the recipe-side
counterpart to a bean's [`id`](04-bean.md#id): any non-empty string, unique
within the document's `recipes` array, compared **exactly and
case-sensitively**. It is never a global identifier, an account, or an
inventory key.

It exists because **array position is not an identity.** A publication that
carries three brew methods is often re-published with them reordered. One can
be added in the middle. Everything that named a recipe by its position then
silently names a different one. That includes the things a reader keeps: a
share link to one method of a bag, a page anchor, a re-shared import. None of
those can be made durable by counting.

- **Optional, and worth emitting whenever a document carries more than one
  recipe.** A single-recipe document needs no id. There is nothing to
  disambiguate, and the document itself is the address.
- **Producers SHOULD keep an id stable across re-publication** of the same
  recipe. An id that changes every time the document is regenerated provides
  nothing that position did not.
- Uniqueness is a semantic rule JSON Schema cannot express. A validator SHOULD
  show a duplicate as a warning. Duplicate ids make every reference to them
  ambiguous. A consumer that resolves one **SHOULD** treat the reference as
  unresolved rather than guess which it meant.
- A consumer that does not care which recipe is which can ignore `id`, as it
  can ignore any member it does not use.

### `bean_ref`

`bean_ref` names the coffee this recipe is for. Its value is the
[`id`](04-bean.md#id) of one element of the document's `beans` array, matched
**exactly and case-sensitively**. It is a document-local reference, never a
global identifier, an account, or an inventory key. It is only needed when a
document carries **several** beans. With a single co-located bean the
association is implicit. The full resolution rules, including unresolved
references, are defined in
[Envelope § Association (explicit reference)](02-envelope.md#association-explicit-reference).

### `recommended`

`recommended: true` marks this recipe as the producer's suggested starting
point. On a bag, it is *the roaster's recommended way to brew that coffee*.
Several recipes MAY carry it, for example one per method: the recommended V60
**and** the recommended AeroPress.

- It is a **declared claim** ([Overview, principle
  1](01-overview.md#how-the-data-is-modeled)): the producer's stated
  suggestion, never a quality assertion about the recipe.
- Absent and `false` are equivalent. Both mean *no statement*. A producer
  **SHOULD** omit the field rather than emit `false`.
- It is document-scoped like every CoffeeJSON field. It says nothing about
  recipes in other documents or in a consumer's library.

### `description`

`description` is the recipe's **one- or two-sentence summary**: what it is and
why you would brew it ("A relaxed weekend pour-over — bright, sweet, and
forgiving."). It is the preview a directory, share card, or search snippet
shows (schema.org `Recipe.description`).

The recipe carries four human-text surfaces, and each has one job. `title`
**names** it. `description` **summarizes** it. [`notes`](#notes) carries
**long-form guidance** (character, tips, troubleshooting). Each step's
`instruction` says **what to do right now**. Text that answers "should I brew
this?" belongs in `description`. Text that answers "how do I get it right?"
belongs in `notes`. All four are hinted by `lang`. The Bean's
[`description`](04-bean.md#description) is different in kind: the roaster's
own attributed prose about the coffee.

### `notes`

`notes` is free-text prose about the recipe as a whole: its character, tips,
or troubleshooting ("bright and tea-like; if it tastes sour, grind finer or
nudge the water hotter"). It is author→reader content that travels with the
recipe, and its language is hinted by `lang`.

- It is distinct from `title` (a short label) and from a step's `instruction`
  (a single step's how-to). Use `notes` for anything about the whole brew.
- It is human text. A consumer shows it verbatim and **MUST NOT** parse it
  for data. Structured parameters always belong in their own fields, never
  mined from `notes`.
- There is no separate "private" notes field. CoffeeJSON carries the recipe's
  shareable identity, not a consumer's personal log.

### Additions

`additions` lists liquids that join the beverage **beyond the brew `water`**:
ice for flash-brew, milk or a sweetener stirred into a finished drink, bypass
water for an americano-style dilution. Each entry is an
[Addition](#addition-object): a `type`, an optional `amount`, and two further
optional members, `temperature` and `note`. `type` is an **open registry**,
not a closed enum. See [Vocabularies § Addition
`type`](06-vocabularies.md#addition-type) for the recommended set and how an
unrecognized value is handled.

The motivating v1.0 case is **ice**, for Japanese-style *flash brew*: hot
coffee brewed directly onto ice, which chills it at once and melts into the
cup.

#### An addition without a quantity

`amount` is **optional**. The reason is worth stating, because this is the one
place in the format where a missing quantity would silently delete a fact the
source did state.

Sources list ice on the ingredient line without a mass, and some print an
unfilled placeholder where the number should be. The presence of an `ice`
addition is what marks the whole recipe **iced**. A required `amount` would
mean an unquantified ice could not be recorded at all, and the recipe could
not be marked iced either. A required quantity would take a semantic flag
down with it.

```json
"additions": [{ "type": "ice", "note": "listed without a quantity" }]
```

This is the opposite call from `water`, where the requirement is load-bearing.
A water-basis recipe with no water states nothing useful. An addition with no
amount still states something true and worth carrying. A consumer renders the
addition and its `note`, and shows no mass.

```json
{
  "coffeejson": "1.0",
  "recipes": [
    {
      "title": "Tetsu Kasuya 4:6 Iced",
      "method": "pour_over",
      "coffee": { "value": 20, "unit": "gram" },
      "water":  { "value": 150, "unit": "gram" },
      "ratio": 7.5,
      "water_temp": { "value": 90, "unit": "celsius" },
      "additions": [
        { "type": "ice", "amount": { "value": 80, "unit": "gram" } }
      ],
      "steps": [
        { "at_s": 0,   "to_water": { "value": 30,  "unit": "gram" } },
        { "at_s": 40,  "to_water": { "value": 60,  "unit": "gram" } },
        { "at_s": 70,  "to_water": { "value": 90,  "unit": "gram" } },
        { "at_s": 100, "to_water": { "value": 120, "unit": "gram" } },
        { "at_s": 130, "to_water": { "value": 150, "unit": "gram" } }
      ],
      "finish_s": 180,
      "notes": "Flash brew: brew hot over 80 g ice so the coffee chills instantly and keeps its aromatics. Half the water of the hot 4:6; the ice melts to dilute. First pour trades sweetness (less) for brightness (more)."
    }
  ]
}
```

- **The presence of an `ice` addition marks the recipe as iced.** There is no
  separate `iced` flag. No other `type` carries a defined structural effect.
  `milk`, `sugar`, `syrup`, `water` (bypass), and `cream` are informational,
  shown but not acted on.
- **`water` and `ratio` describe the brew, not the finished drink.** `water`
  is what is poured through the bed (150 g above). `ratio` stays
  `water / coffee` (7.5), the *concentrate* ratio. A consumer MAY compute the
  effective dilution as `(water + Σ addition amounts) / coffee` (≈ 11.5 above)
  for display. The format does not store it.
- **Additions are independent of `basis`.** An iced pour-over is a water-basis
  recipe (`water`) plus `additions`. Additions never require or forbid
  `water` / `yield` / `ratio`.
- A consumer that does not model additions **MUST NOT** fail. It ignores the
  field and, without ice, presents a stronger, un-chilled brew. Iced behavior
  is best-effort, never required.
- A consumer that does model additions but meets a `type` it does not
  recognize **MUST** still show `amount` (and `temperature` / `note` if
  present) rather than drop the entry. This is the same forward-compatibility
  contract as every other field in the format.

---

## Measurement object

A quantity with an explicit unit. Used for `coffee`, `water`, `yield`,
`water_temp`, `pressure`, and an addition's `amount` / `temperature`. Bean
altitude uses the same unit-identifier principle with a range-capable
[Altitude](04-bean.md#altitude-object) object.

**When a quantity is a Measurement, and when it is a bare number.** A quantity
travels as a `{value, unit}` Measurement when producers state it in different
units (mass, temperature, pressure, length), because the unit choice is real
information. A quantity with a single canonical unit travels as a **bare
number whose name carries the unit**. Durations are seconds (`at_s`,
`finish_s`, `preinfusion_s`, `action_duration_s`). Approximate particle size
is microns (`microns_approx`). `ratio` is dimensionless. A unit object there
would be ceremony with exactly one possible value.

```json
{ "value": 250, "unit": "gram" }
```

```json
{ "min": 18.5, "max": 19, "unit": "gram" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `value` | number | one of | A single stated magnitude. |
| `min` | number | one of | Lower bound, when the source states a window. |
| `max` | number | one of | Upper bound, when the source states a window. |
| `unit` | string | yes | Mass: `gram`, `ounce`. Volume (brew `water` only): `milliliter`. Temperature: `celsius`, `fahrenheit`. Pressure: `bar`. See [Water quantity](#water-quantity). |

A Measurement **MUST** carry `unit` and at least one of `value`, `min`, or
`max`. This is the same rule as [Altitude](04-bean.md#altitude-object), which
carries ranges because origins are commonly listed as elevation bands.

### Stated windows

Brewing guidance is often published as a window rather than a point: an
espresso yield of 32–34 g, a dose of 25–45 g for a recipe that scales with the
press, a brew temperature of 92–94 °C. A window is what the author stated. The
format carries it rather than force a producer to invent a point.

- **State the window or the point, never both.** A Measurement that carries
  `value` beside `min`/`max` is contradictory. Producers **MUST NOT** emit it,
  and **the schema rejects it** (`dependentSchemas`: a present `value` forbids
  `min`/`max`). The one contradiction the schema cannot express is `min`
  greater than `max`. Validators **SHOULD** warn on that.
- **One-sided windows are legal.** `{ "min": 25, "unit": "gram" }` says "at
  least 25 g" and nothing about an upper bound, which is what some sources
  state.
- **A consumer that needs a single number derives one and says so.** It can
  take the midpoint for display, or `min` for a schedule. It **MUST NOT**
  present a derived point as the author's number. This is the same rule as
  [Scaling](#scaling): a consumer that applies its own model owns the result.
- **`ratio` is unaffected.** It remains a bare dimensionless number that
  describes the relationship between `water` and `coffee`. When both are
  windows it is often the thing that *couples* them. A French press guide
  that states 25–45 g of coffee to 375–675 g of water states one ratio of 15
  across the range. `ratio` carries that coupling without loss, where two
  independent windows would not.
- **Durations do not take windows.** `at_s`, `finish_s`, `preinfusion_s` and
  `action_duration_s` are bare numbers by design (see above). A published time
  window belongs in `notes` or the step's `instruction`.

### Water quantity

Brew water is the one input publishers state **either by mass or by volume**,
because it is a liquid of known density. A guide that prints `お湯 92℃ 225cc`
beside a dose in grams is ordinary, not exotic. So [`water`](#fields) and a
step's [`to_water`](#step-object) accept `milliliter` in addition to `gram`
and `ounce`. The ounce is the avoirdupois mass ounce. A source that states
*fluid* ounces states a volume, which belongs in `milliliter` (see
[Units](06-vocabularies.md#units)). Everything else stays a mass. A dose, a
beverage `yield`, and an addition's `amount` are masses in every source the
format has met.

```json
{ "value": 225, "unit": "milliliter" }
```

**No conversion between the two is defined.** Water's density varies with
temperature. 225 mL is 225 g only near 4 °C, and at a stated 92 °C it is
≈216.8 g, a 3.6 % error, coarser than the precision such a guide is written
to. A consumer that needs the other kind applies its own model. It
**MUST NOT** present the result as the author's figure, exactly as under
[Scaling](#scaling). Producers emit what their source stated.

A recipe whose `water` is a volume states no mass ratio, so it omits
[`ratio`](#ratio). See there.

- Producers **MUST** emit canonical unit identifiers, not localized display
  symbols (`gram`, not `g`; `celsius`, not `°C` or `C`).
- Consumers **MUST** convert any unit they recognize into their own canonical
  store.
- Consumers **MUST NOT** show the wire `unit` string directly. They render
  localized labels and symbols with platform measurement APIs or their own
  locale tables.
- If a consumer does not recognize the `unit`, it **MUST** treat the
  measurement as absent. It **MUST NOT** guess. A value silently stored in
  the wrong unit is worse than nothing.
- A Measurement's `value` is **strictly positive** for mass and pressure. A
  zero-gram dose or a zero-bar pressure states nothing, and the schema rejects
  it. Temperatures can be zero or below, and a zero-second `at_s` offset is
  real data.

The full unit vocabulary, including conversion factors, is in
[Vocabularies § Units](06-vocabularies.md#units).

---

## Filter object

What the water passes through on its way out of the bed. Publishers state it
on brew guides far more often than on product pages, and it changes the cup.
Paper retains oils and fines, metal lets them through, and cloth sits between.

```json
{ "material": "paper", "label": "Chemex bonded — 3-ply on one side" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `material` | string (enum) | yes | `paper` · `metal` · `cloth` · `other`. Unknown → `other`. See [Vocabularies § Filter material](06-vocabularies.md#filter-material). |
| `label` | string | no | The filter as the source names it, when that says more than the material. Human text; language hinted by `lang`. |

`material` is the queryable, portable part. `label` carries what the enum
flattens: a product (`"V60-02"`), a form (a tea bag), or the brewer's own part
(a plunger mesh). The specific product is usually implied by the `brewer`,
which is why the label is free text rather than a registry.

Three things that look like filter data and are not:

- **Rinsing** is a [step](#step-object), not a property of the filter. It is a
  `prep` step with an instruction, where a guide can say what to do with the
  rinse water.
- **A negation** ("this brewer doesn't use a paper filter, so the cup is rich
  with oils") is prose for [`notes`](#notes). State the filter positively, for
  example the metal one in a French press, and let the prose keep the *why*.
- **A choice** ("either paper or mesh") is a guide that describes a family
  rather than one brew. Omit `filter` and say so in `notes`. A recipe states
  the filter it calls for, not the options.

## Gear object

One shape for any piece of equipment: a grinder, a brewer, or a basket. It
carries three things at once, so that "separate brand + product" and
"combined product name" are both representable: a canonical **id** for
matching, normalized **brand** / **model** for querying, and a display
**label** for fallback.

```json
{ "id": "hario-v60", "brand": "Hario", "model": "V60", "label": "Hario V60" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Canonical registry slug — lowercase kebab-case, schema-enforced — or the literal `"custom"` for off-registry gear. This is the field other apps match on (byte-exact), which is why the grammar is strict: a mis-cased id would validate yet match nothing. |
| `brand` | string | no | Normalized brand, for example `Hario`. |
| `model` | string | no | Normalized model, for example `V60`. |
| `label` | string | no | Display string / fallback. Required when `id` is `"custom"`, and schema-enforced there, since there is no registry entry to localize. |

Consumer behavior:

- For a **known** `id`, a consumer **SHOULD** prefer its own localized label
  over the producer's `label`, so the same gear reads consistently in the
  consumer's locale.
- For `id: "custom"`, a consumer shows the producer's `label` verbatim.
- An unknown (non-`"custom"`) `id` is treated like `"custom"`: fall back to
  `label`, then to `brand` / `model`. A consumer **MUST NOT** fail on an
  unrecognized `id`.

The registry of known slugs is curated, open, and non-exhaustive by design.
`id: "custom"` plus `label` always works, so missing coverage never blocks a
share. See [Vocabularies § Gear registry](06-vocabularies.md#gear-registry).

---

## `method` vocabulary

`method` is the brewing **technique**, distinct from the `brewer` **device**.
A V60 (device) is used with a `pour_over` (technique). An AeroPress (device)
can be used `immersion` or `pour_over`. Keeping them separate prevents
conflating "what I used" with "how I used it."

The v1.0 values are stable machine ids. Consumers localize them:

`pour_over` · `immersion` · `aeropress` · `french_press` · `moka` ·
`cold_brew` · `siphon` · `cezve` · `drip` · `capsule` · `espresso` · `other`

Notes: `drip` is a batch / filter machine. `capsule` is a pod system. `cezve`
is ibrik / Turkish. A consumer that meets an unrecognized value **MUST** treat
it as `other`. New methods can be added in a minor version. The full table is
in [Vocabularies § method](06-vocabularies.md#method).

**`espresso` sets `basis: "yield"`.** `method` is descriptive. The recipe's
`basis` carries the structural rule: a `basis: "yield"` recipe (espresso's
basis) REQUIRES `yield` and **MUST NOT** carry `water` or `ratio`, so its
required numbers always mean what they say. See
[Espresso (dose : yield)](#espresso-dose--yield).

---

## Grind object

`setting`, `microns_approx`, and `size` are **three views of one target
grind** at different precisions and portabilities. A consumer shows the most
specific axis it understands: `setting` when the reader has the sender's
grinder, else `microns_approx`, else `size`. It need not reconcile them. They
are independent expressions, not derivations of each other.

```json
{
  "grinder": { "id": "comandante-c40", "brand": "Comandante", "model": "C40", "label": "Comandante C40" },
  "setting": "22 clicks",
  "microns_approx": 700,
  "size": "medium_fine"
}
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `grinder` | [Gear](#gear-object) | no | The grinder used. |
| `setting` | string | no | The setting **as expressed on that grinder** ("22 clicks", "6.5", "stepless 1.4 turns"). Free text. |
| `microns_approx` | number | no | Approximate particle size in microns (strictly positive). Explicitly approximate — the only roughly-portable axis. |
| `size` | string (enum) | no | Qualitative coarseness on the standard seven-level scale (ordered). See [Grind `size` vocabulary](06-vocabularies.md#grind-size). Unknown → ignore the field, preferring `setting` / `microns_approx` when present. |

Grind is the one place CoffeeJSON refuses to be clever:

- `setting` is **free text** and **MUST NOT** be coerced to a number. Grinder
  scales are not portable. "22 clicks" means nothing on a different grinder,
  so the setting is preserved exactly as the sender expressed it.
- `microns_approx` is the only axis that is even loosely comparable across
  grinders, and it is explicitly approximate. A consumer **MUST NOT**
  automatically apply it to a different grinder's dial.
- `size` sits **beside** `setting` and `microns_approx`, not above them. It is
  the qualitative read ("medium-coarse") on a standard scale, comparable
  across grinders in a way `setting` never is, and coarser-grained than
  `microns_approx`. A consumer that meets an unrecognized `size` value, or no
  `size` at all, falls back to `setting` / `microns_approx` for display.
- **No cross-grinder conversion is defined or expected in v1.0.** A consumer
  shows the sender's `grinder` / `setting` / `microns_approx` / `size` as
  stated and lets the user dial in their own equipment.

Structured grind data means a conversion layer can be added later with no
format change, and the format never produces a confidently-wrong number
today.

---

## Step object

A brew is an **ordered sequence of actions**. Most steps are timed pours, but
a step can be an untimed prep action or a manipulation. **Array order is
authoritative.** `at_s` is an optional timing annotation, and `to_water`
applies only to pour-type steps. See [The data-guard
rule](#the-data-guard-rule) for exactly how a consumer tells the difference.
Across the steps that carry them, a producer **SHOULD** emit `at_s` and
`to_water` non-decreasing in array order: time runs forward and the scale
reading only rises. A consumer **MUST NOT** reorder steps to repair a schedule
that does not — it keeps array order and shows the numbers it was given, so a
recipe never plays differently in two apps.

The everyday pour-over step is `{ "at_s", "to_water" }`. `kind` defaults to
`pour`, so a common recipe is a simple list of *(time, target weight)*.

```json
{ "kind": "pour",  "at_s": 30, "to_water": { "value": 150, "unit": "gram" }, "instruction": "slow circle pour" }
{ "kind": "bloom", "at_s": 0,  "to_water": { "value": 45,  "unit": "gram" }, "instruction": "saturate, swirl gently" }
{ "kind": "prep",  "instruction": "rinse filter, preheat dripper" }
{ "kind": "flip",  "instruction": "invert the AeroPress" }
{ "kind": "press", "at_s": 90, "instruction": "press gently over ~20s" }
{ "kind": "distribute", "instruction": "WDT until the bed is level" }
{ "kind": "pull",  "instruction": "line pressure to 3.5 s, then 9 bar" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `kind` | string (enum) | no | Default `pour`; unknown → `other`. `bloom` is pour-type — see [Bloom](#bloom). The value list lives in **one** place: [Vocabularies § Step `kind`](06-vocabularies.md#step-kind). |
| `at_s` | number | no | Seconds from brew start to cue this step. **Absent = sequential / user-paced** (prep, flips). |
| `to_water` | Measurement | no | **Cumulative** water in the cup by the **end** of this step — the scale's target reading. Same `{value,unit}` shape as `water`. Pour-type steps only. |
| `instruction` | string | no | Free-text how-to ("center then circle", "agitate", "shake the dripper"). Human text — see `lang`. |
| `label` | string | no | Present **only if** the author explicitly customized it. See the rule below. |
| `action_duration_s` | number | no | How long this step's action takes, in seconds. See [Action duration](#action-duration). |

### Cumulative water

`to_water` is **cumulative**, not per-step. It is the total water in the cup
by the *end* of the step, the weight the scale should read at that point. A
[bloom](#bloom) to 30 g followed by a pour to 150 g means the second pour ends
at 150 g, having added 120 g. A consumer shows the cumulative target and, if
it likes, the per-pour amount (the difference from the previous step).
Cumulative targets are how scale-based pour-over is executed: pour until the
scale reads the number.

### The data-guard rule

Whether a step is **water-bearing** (belongs in the pour schedule) is decided
by its **data**, not its `kind`. Any step that carries both `at_s` and a
usable `to_water` is water-bearing, whatever `kind` says. A consumer **MUST**
schedule water off that pair and **MUST NOT** gate scheduling on a `kind`
allowlist.

This is what makes new pour-type kinds forward-compatible for free. `bloom`
(below) carries `at_s` + `to_water` exactly like `pour`, so a consumer that
follows this rule already schedules it correctly with no code change. The
same holds for any pour-type kind a future minor version adds. The corollary
is the safety net. A consumer that does not recognize a `kind` has nothing to
consult but the data. An unrecognized pour-type kind can at most **degrade to
label-only** (shown through its `instruction`, not scheduled). It can never
produce broken or miscounted water math, because `kind` is never part of how
the number is computed.

### Bloom

`bloom` is a **pour-type** step kind for the initial pre-wet: a short pour
(usually around twice the coffee's mass in water) that saturates the grounds
and lets trapped CO₂ escape before the main pour schedule continues. It
carries `at_s` + `to_water` exactly like `pour`:

```json
{ "kind": "bloom", "at_s": 0, "to_water": { "value": 45, "unit": "gram" } }
```

Any consumer that follows [the data-guard rule](#the-data-guard-rule) picks it
up with no special-casing.

An ordinary `pour` (or kind-defaulted) step at `at_s: 0` is also valid for the
same pre-wet. Naming it `bloom` lets a producer state the step's *purpose*. A
consumer can then render its own localized "Bloom" label from the kind rather
than the author serializing one. This is the same principle as [the
derived-label rule](#the-derived-label-rule) below.

### Action duration

`action_duration_s` states how long the step's **action** itself takes, in
seconds. It is a single value, distinct from `at_s` (*when* the step starts).
It applies to any step whose action has a duration worth recording: a slow
controlled pour, a `press` (the plunge), a `stir`.

Paired with the water delta between this step and the previous one (this
step's `to_water` minus the previous step's), `action_duration_s` yields the
pour **rate** in g/s. That is useful when cadence matters as much as total
volume. A consumer that does not compute rate ignores the field. Deriving it
is optional presentation, never required to render the schedule.

### The derived-label rule

`label` carries a *customized* name only. A **derived or default** label
("Bloom", "Pour 2", "Drawdown") **MUST** be serialized as absent, so that each
consumer renders its own localized default from the step's position and kind.
Emitting "Bloom" would freeze one language into the data. Omitting it lets a
consumer show "Bloom", "ブルーム", or "Floração" as appropriate. This rule is a
direct consequence of principle 2 ([locale-neutral on the wire](01-overview.md)).

### Mixed-capability consumers

Array order **MUST** be preserved by every consumer. A consumer that only
models timed pours builds its schedule with [the data-guard
rule](#the-data-guard-rule): every step with `at_s` + a usable `to_water`,
whether `pour`, `bloom`, or a kind it has never heard of. It shows every other
step **read-only** instead, for example its `instruction` shown but
unscheduled. Such a consumer **MUST NOT** fail on a step kind it does not
implement. An unmodeled step is shown, never an error.

The espresso kinds (`distribute` (WDT), `tamp`, `pull`) are steps like any
other. None of them carry `to_water`, because the shot's numbers (yield,
pressure, time) live at the recipe level, never on a step. So the data-guard
rule surfaces them read-only, and a consumer that does not model espresso
needs no espresso-specific check to get that right.

---

## Addition object

A liquid added to the brew beyond the brew `water`. `type` is an **open
registry** (recommended: `ice`, `milk`, `sugar`, `syrup`, `water`, `cream`),
not a closed enum. The object stays small on purpose, and a new kind of
addition is a new string, never a schema change. `temperature` and `note` are
optional members for when something beyond the amount is worth recording.

```json
{ "type": "ice", "amount": { "value": 80, "unit": "gram" } }
```

```json
{
  "type": "milk",
  "amount": { "value": 100, "unit": "gram" },
  "temperature": { "value": 65, "unit": "celsius" },
  "note": "oat"
}
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `type` | string | yes | What is added — an **open registry**, not a closed enum: any value is valid. Recommended: `ice` · `milk` · `sugar` · `syrup` · `water` · `cream`. See [Addition `type` vocabulary](06-vocabularies.md#addition-type). |
| `amount` | [Measurement](#measurement-object) | no | How much is added, by mass. Recommended unit `gram`. Omitted when the source lists an addition without a quantity — see [An addition without a quantity](#an-addition-without-a-quantity). |
| `temperature` | [Measurement](#measurement-object) | no | Temperature of the added liquid, where meaningful (for example steamed milk). Recommended unit `celsius`. |
| `note` | string | no | Free-text detail — brand, prep, sweetener kind. Human text — see `lang`. |

- `ice` denotes coffee brewed onto ice (Japanese-style flash brew). The ice
  both chills the brew and melts into the beverage, and its presence marks the
  recipe iced. See [Additions](#additions).
- Additions do not change the meaning of `water` or `ratio`. No cross-field
  arithmetic is implied. A consumer that wants a total-dilution figure derives
  it.
- A consumer that does not recognize a `type` value handles it
  **generically**: it shows `type` and `amount` (and `temperature` / `note` if
  present) without special-casing it, and it **MUST NOT** fail. Only `ice`
  carries a defined behavioral effect (marking the recipe iced). Every other
  value, known or not, is informational.

---

## Party object

A person or organization credited on a document. One shape for every credit:
recipe [`author`](#attribution-author-based_on), bean
[`roaster`](04-bean.md#fields), and each entry of an origin item's
[`producers`](04-bean.md#who-produced-it). A consumer renders a producer with
the code it already uses for a roaster or an author, and a structured-data
exporter emits the same Person / Organization node.

```json
{ "name": "Tetsu Kasuya", "url": "https://en.philocoffea.com" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Display name, as the source writes it. Never empty. |
| `url` | string (URI) | no | The party's own page — a profile, site, or channel. |
| `type` | string (enum) | no | `person` · `organization`, when known. Absent/unknown → infer from the crediting field. See [Party `type`](06-vocabularies.md#party-type). |
| `role` | string | no | The part this party played, on any credit. An [open registry](06-vocabularies.md#producer-role). |

## Field mapping summary

| Concept | Field | Canonical form |
| --- | --- | --- |
| Coffee dose | `coffee` | `gram` measurement |
| Brew water | `water` | `gram` measurement (not on a yield-basis recipe) |
| Beverage yield | `yield` | `gram` measurement (required when `basis` is `yield`) |
| Ratio | `ratio` | bare number (water ÷ coffee; not on a yield-basis recipe) |
| Brew pressure | `pressure` | `bar` measurement |
| Pre-infusion | `preinfusion_s` | seconds (number) |
| Basket | `basket` | [Gear](#gear-object) |
| Water temperature | `water_temp` | `celsius` measurement |
| Technique | `method` | machine id ([vocabulary](06-vocabularies.md#method)) |
| Stated-quantity basis | `basis` | machine id — `water` (default) · `yield` ([vocabulary](06-vocabularies.md#basis)) |
| Device | `brewer` | [Gear](#gear-object) |
| Grinder + setting | `grind` | [Grind](#grind-object) |
| Pour schedule | `steps` | ordered [Step](#step-object) array |
| Recipe author | `author` | [Party](#party-object) |
| Original publication | `based_on` | URI string (schema.org `isBasedOn`) |
| Linked coffee | `bean_ref` | the [`id`](04-bean.md#id) of a bean in this document |
| Producer's pick | `recommended` | boolean; omitted unless `true` |
| Recipe notes | `notes` | free-text prose (human text) |
| Added liquids | `additions` | [Addition](#addition-object) array — open `type` registry |
