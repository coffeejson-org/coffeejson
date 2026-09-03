# Vocabularies & registries

CoffeeJSON is [locale-neutral on the wire](01-overview.md). Everything
enumerable travels as a stable machine id, and each consumer renders its own
localized label. This document is the single home for every controlled
vocabulary.

Three kinds appear here:

- **Closed enums** — small, stable value sets defined entirely by the
  specification (for example `roast_level`). New values arrive only with a
  spec revision.
- **Open registries** — curated, extensible lists of ids with an explicit
  escape hatch (`gear`, `varietal`, `country`, addition `type`). Coverage
  grows over time and is never required to be complete, because an
  off-registry value always has a defined fallback.
- **Free strings** — values carried verbatim (`setting`, `harvest_time`), or
  still exploratory and **reserved for a future registry** (`drying_method`,
  `certifications`).

**The tiering rule.** A vocabulary is a *closed enum* when its value set is
small, stable, and load-bearing for interop. That is where cross-implementation
comparison or unit conversion depends on shared meaning, and a wrong guess is
worse than no value. It is an *open registry* when the set is open-ended but
canonical ids pay for themselves in localization and matching. It stays a
*free string* when the value is inherently verbatim or the space is still
exploratory.

**Promotion is one-way.** A free string can later be backed by a registry:
pure data plus SHOULD guidance, which changes no document's validity. A closed
enum grows by minor revision. Each candidate value passes three gates:

- **common** — real sources keep stating the concept and this vocabulary
  cannot express it. Both outcomes count: documents that land in the
  fallback, *and* documents that omit the field. The second happens when the
  fallback would say less than the source did while looking like a positive
  claim. A careful producer chooses the second, so a count of the first alone
  would make a well-behaved corpus look like it had no demand.
- **converged** — the field has settled on one name for it.
- **queryable** — consumers would filter by it. A value meaningful only
  inside one producer's own lineup fails here however often it appears.

A shipped free string never becomes an enum, because that would invalidate
existing documents.

**Unknown-value handling — the dividing line.** Three behaviors appear below,
and the split is principled. **Categorical** sets, where "something not
listed" is itself a usable answer, map unknown values to **`other`**
(`method`, step `kind`, `process`, `form`, filter `material`). **Ordered
scales and claims**, where a wrong bucket would assert something false about
the coffee, are **ignored**, each with its stated recovery. Those are:
`roast_level` → prefer `roast_agtron`; grind `size` → prefer
`setting`/`microns_approx`; party `type` → infer by role;
`preferred_extraction` → ignore the value, keep the recipe. **Derivable
switches**, where the document's own data answers the question, are
**derived** (`origin.type` from the item count; `basis` from the quantities
present). The mechanical consequence: an enum defines an `other` value exactly
when mapping to it is safe. A vocabulary without `other` follows its stated
ignore or derive rule.

**Casing.** Enum values and free-string tokens are lowercase `snake_case`
(`pour_over`, `raised_bed`). Registry slugs are `kebab-case` (`hario-v60`).
Externally standardized codes follow their standard (ISO 3166-1 uppercase
alpha-2; BCP-47 canonical casing).

Some free strings are not tokens at all but **human text carried verbatim**: a
grinder `setting`, a `harvest_time`, a flavor descriptor. Those have no
casing rule to follow. They keep the source's own spelling, spacing and case,
and a producer **MUST NOT** tokenize them. Where two such values need to be
compared, the section that defines them says how.

For **all** of them, the [forward-compatibility contract](01-overview.md)
holds: an unrecognized value **MUST NOT** cause a consumer to fail. Each
vocabulary below states its specific fallback. The published JSON Schema is
the **producer gate for the current minor**. It rejects values a newer minor
may define, and it is never an inbound import gate. See
[Versioning § The published schema](07-versioning.md#the-published-schema).

## Index

| Vocabulary | Kind | Used by | Fallback for unknown value |
| --- | --- | --- | --- |
| [Units](#units) | closed | `coffee`, `water`, `yield`, `to_water`, `water_temp`, `pressure`, `altitude` | Treat measurement as absent |
| [`method`](#method) | closed | `recipe.method` | `other` |
| [`basis`](#basis) | closed | `recipe.basis` | Derive from the quantities present |
| [Step `kind`](#step-kind) | closed | `recipe.steps[].kind` | `other` |
| [Grind `size`](#grind-size) | closed | `recipe.grind.size` | Ignore field (prefer `setting`/`microns_approx`) |
| [`process`](#process) | closed | `bean.process`, `bean.origin.items[].process` | `other` |
| [Filter material](#filter-material) | closed | `recipe.filter.material` | `other` |
| [`roast_level`](#roast_level) | closed | `bean.roast_level` | Ignore field |
| [`form`](#form) | closed | `bean.form` | `other` |
| [`preferred_extraction`](#preferred_extraction) | closed | `bean.preferred_extraction` | Ignore field |
| [`origin.type`](#origintype) | closed | `bean.origin.type` | Derive from item count |
| [Party `type`](#party-type) | closed | `author.type` · `roaster.type` (any [Party](03-recipe.md#party-object)) | Ignore field; infer by role |
| [Gear registry](#gear-registry) | open | `brewer`, `grind.grinder` (`id`) | `label` → `brand`/`model` |
| [Addition `type`](#addition-type) | open | `recipe.additions[].type` | Handled generically |
| [Producer `role`](#producer-role) | open | `producers[].role` (any [Party](03-recipe.md#party-object)) | Display beside the name |
| [Varietal registry](#varietal-registry) | open | `bean.varietals[]` | Pass through verbatim |
| [`drying_method`](#drying-method) | free² | `bean.drying_method` | Pass through verbatim |
| [`certifications`](#certifications) | free² | `bean.certifications[]` | Pass through verbatim |
| [Flavor descriptors](#flavor-descriptors) | free² | `tasting.descriptors[]` | Pass through verbatim |
| [Country codes](#country-codes) | open¹ | `bean.origin.items[].country` | Pass through verbatim |

¹ Country codes are an external standard (ISO 3166-1), referenced rather than
curated by CoffeeJSON.

² The **free-string** kind: no controlled vocabulary, and a consumer passes
every value through unchanged. `drying_method` and `certifications` are
exploratory, reserved for a future registry (the one-way promotion path
above). Flavor descriptors are free **by design** and are not reserved for
one. They are the drinker's own words, and a list would lose the words worth
keeping.

---

## Closed enums

### Units

Used by every [Measurement](03-recipe.md#measurement-object) and by
[`bean.origin.items[].altitude`](04-bean.md#altitude-object).

| Dimension | Unit identifier | Conversion to recommended store |
| --- | --- | --- |
| Mass | `gram` | already grams |
| Mass | `ounce` | `1 ounce = 28.349523125 gram` |
| Volume | `milliliter` | no defined conversion to mass — see below |
| Temperature | `celsius` | already Celsius |
| Temperature | `fahrenheit` | `celsius = (fahrenheit − 32) × 5⁄9` |
| Length | `meter` | already meters |
| Length | `foot` | `1 foot = 0.3048 meter` |
| Pressure | `bar` | already bar (v1.0's only pressure unit) |

**Volume is water-only, and unconvertible by design.** `milliliter` is
accepted by [`recipe.water`](03-recipe.md#water-quantity) and
[`step.to_water`](03-recipe.md#step-object) and by nothing else. Publishers
state brew water either way. A Japanese guide that prints `お湯 92℃ 225cc`
beside a dose in grams is ordinary. A dose, a beverage yield and an
addition's amount are always masses. There is **no conversion factor**,
because water's density varies with temperature. 225 mL is 225 g only near
4 °C, and at a stated 92 °C it is ≈216.8 g. A consumer that needs the other
kind applies its own model. It **MUST NOT** present the result as the
author's figure, the same rule as [Scaling](03-recipe.md#scaling).

**`ounce` straddles that same line, because the name sits on both sides.**
`ounce` is the avoirdupois **mass** ounce (28.349523125 g), never a fluid
ounce. A source that states brew water in *fluid* ounces states a volume.
Emit `milliliter` (10 fl oz ≈ 296 mL). A conversion from fluid ounces to
`gram` crosses exactly the boundary the paragraph above declines to bridge.
The naive figure holds only near 4 °C, and a US guide's `10 fl oz` is ≈285 g
at brew temperature.

These identifiers are wire values, not display strings. Producers **MUST**
emit the canonical identifiers above and **MUST NOT** emit symbols or
localized labels such as `g`, `oz`, `C`, `°C`, `grams`, or `グラム`. The
identifiers are CoffeeJSON's own, chosen to read as words; they are not
UCUM, QUDT, or UN/CEFACT codes, and the format defines no mapping to any of
them. Consumers **MUST** convert any unit they recognize and **MUST** treat
a measurement with an unrecognized unit as absent (never guess).

### `method`

The brewing technique. Used by `recipe.method`. Unknown value → `other`.

| Value | Meaning |
| --- | --- |
| `pour_over` | Gravity percolation with a manual pour (V60, Kalita, Origami…). |
| `immersion` | Steep then separate (full-immersion drippers, steep-and-release). |
| `aeropress` | AeroPress, any orientation. |
| `french_press` | Full-immersion plunger pot. |
| `moka` | Stovetop moka pot. |
| `cold_brew` | Long ambient / cold extraction. |
| `siphon` | Vacuum / siphon brewer. |
| `cezve` | Cezve / ibrik / Turkish. |
| `drip` | Batch / automatic filter machine. |
| `capsule` | Pod / capsule system. |
| `espresso` | Pressurized extraction — dose in, beverage **yield** out (typically paired with `basis: "yield"`, the structural switch). |
| `other` | Anything not listed, or unknown. |

New methods can be added in a minor version. That is why an unrecognized value
maps to `other` rather than fails.

`method` is descriptive only and does not itself change field requirements.
The recipe's [`basis`](#basis) is the structural switch. A yield-basis recipe
(`basis: "yield"`, usually paired with `method: "espresso"`) REQUIRES `yield`
and **MUST NOT** carry `water` or `ratio`. Those fields (total brew water;
water ÷ coffee) would misdescribe a shot. See
[Recipe § Espresso (dose : yield)](03-recipe.md#espresso-dose--yield).

### `basis`

Used by `recipe.basis`, **the structural switch** for which brew quantity a
recipe states. Default `water` when absent. Unknown → **derive the effective
basis from the quantities present**.

| Value | Meaning |
| --- | --- |
| `water` | Stated by total brew water (the default): requires `water` **or** `ratio`, which each fix the other given the always-required `coffee`; `yield` MAY additionally state the beverage out. |
| `yield` | Stated by beverage mass out (espresso's basis): requires `yield`; **MUST NOT** carry `water` or `ratio`. |

Because `basis` decides which field is REQUIRED, it cannot grow the way other
vocabularies do. A new value would change which required quantity exists, so
it is **breaking in effect** and waits for a major version. See
[Versioning § The required-quantity trap](07-versioning.md#versioning). A
consumer can still meet an unknown value: a newer-major document, or
malformed input such as a hand-authored `basis: "espresso"`. It derives the
effective basis from the data, **in this order**, because a water-basis recipe
MAY state a `yield` too and a bare "which is present" test would read one as a
shot: `water` **or** `ratio` present → water-basis. Otherwise `yield`
present → yield-basis. Otherwise the recipe states no brew quantity, and its
title, steps, and notes still render. This is the same
document-data-answers-it rule as `origin.type` and the
[step data-guard](03-recipe.md#the-data-guard-rule).

### Step `kind`

Used by `recipe.steps[].kind`. **Default `pour`** when absent. Unknown →
`other`. `pour` and `bloom` are the **pour-type** kinds. See [Recipe § The
data-guard rule](03-recipe.md#the-data-guard-rule) for how a consumer decides
whether *any* step, including a future pour-type kind, is water-bearing.

| Value | Timed? | Meaning |
| --- | --- | --- |
| `pour` | usually | Add water. Carries `to_water`; usually carries `at_s`. |
| `bloom` | usually | Initial pre-wet pour — saturates the grounds before the main schedule. Carries `to_water` + `at_s` like `pour`. See [Recipe § Bloom](03-recipe.md#bloom). |
| `prep` | no | Preparation (rinse filter, preheat). |
| `wait` | usually | An interval with no action — a steep, a rest between pours, a cold-brew hold. Carries `at_s` and/or `action_duration_s`; moves no water. |
| `stir` | optional | Agitate the slurry. |
| `flip` | no | Invert the brewer (for example inverted AeroPress). |
| `valve_open` | no | Open the brewer's valve — a Hario Switch released to drain. |
| `valve_close` | no | Close the brewer's valve — a Switch shut to steep as an immersion. |
| `press` | optional | Apply pressure / plunge. |
| `drawdown` | optional | The bed draining after the last pour, when the author calls it out as its own step. |
| `distribute` | no | Distribute / settle the grounds in the basket (WDT). |
| `tamp` | no | Compact the puck. |
| `pull` | optional | Run the espresso shot. Instructions only — the shot's numbers live on the recipe. |
| `other` | optional | Any step kind not listed, or unknown. |

A consumer that does not model a kind (a pour-over app that meets `tamp`,
say) still preserves the step and shows it read-only (see
[Recipe § Step](03-recipe.md)).

`valve_open` and `valve_close` are brewer-state changes in the same family as
`flip`. They move no water. They exist because a valved brewer is used two
ways in one recipe, shut to steep and opened to drain. No other kind can
express that. A recipe that never moves its valve does not need them.

Not a value here: **`swirl`**. Agitating the slurry is `stir`, whichever
motion the author describes. A second value for the same act would leave two
producers describing one step differently.

### Grind `size`

Used by `recipe.grind.size`: qualitative coarseness on a standard perceptual
scale (ordered). It sits beside the grinder-specific `setting` and the
approximate `microns_approx` (see [Grind object](03-recipe.md#grind-object)).
Unknown → **ignore the field**, and prefer `setting` / `microns_approx` when
present.

`extra_fine` · `fine` · `medium_fine` · `medium` · `medium_coarse` · `coarse` ·
`extra_coarse`

An ordered scale, finest to coarsest. `extra_fine` suits espresso,
`extra_coarse` suits cold brew / French press, and pour-over sits in the
middle grades. No cross-grinder conversion is implied. `size` is a shared
vocabulary for perceptual coarseness, not a substitute for a grinder's own
dial.

### `process`

Post-harvest processing. Used by `bean.process` and, per blend component, by
`bean.origin.items[].process`. The components of a blend are often processed
differently, for example a washed Colombia beside a natural Ethiopia. Unknown
→ `other`.

**Both fields are list-valued**, because a coffee often has more than one
process to state and one value cannot say so. See [Bean § Processes are a
set](04-bean.md#processes-are-a-set).

| Value | Meaning |
| --- | --- |
| `washed` | Fully washed / wet process. |
| `natural` | Dry / natural process. |
| `pulped_natural` | Pulped natural. |
| `honey` | Honey process. |
| `anaerobic` | Anaerobic fermentation. |
| `carbonic_maceration` | Carbonic maceration — whole cherries ferment in a sealed vessel under carbon dioxide. Naming it is not also a claim of `anaerobic`. A coffee stated as both carries both. |
| `wet_hulled` | Wet-hulled (*giling basah*) — the bean is hulled at high moisture, the standard method across Sumatra. |
| `other` | Any process not listed, or unknown. |

A roaster's own process name stays in the bean's `description` or, for a
blend component, often in the origin item's `name`. `process` carries the
**comparable categories**. The distinction is between a name this vocabulary
does not cover and a coffee that has several values it does. "Koji Natural"
names a fermentation this list has no id for, so it is `["natural"]` plus the
roaster's words in prose. "Double Anaerobic Honey" names two processes that
are both here, so it is `["anaerobic", "honey"]` and nothing is lost. New
values arrive by minor revision through the promotion gates stated in the
introduction.

### Filter material

Used by `recipe.filter.material`: what the brew filter is made of. Unknown →
`other`.

| Value | Meaning |
| --- | --- |
| `paper` | A paper filter: retains oils and fines, giving a cleaner cup. |
| `metal` | A metal mesh or perforated screen — a French press plunger, a reusable cone. |
| `cloth` | A cloth / flannel filter. |
| `other` | Any filter material not listed, or unknown. |

A small closed set, because the material is the part that is portable and
affects taste. A consumer can filter a corpus by it, which the specific
product name would not allow. The product itself goes in `filter.label`, free
text, because it is usually implied by the brewer.

**Not** a value here: "no filter". Unfiltered brewing (cezve, a cupping bowl)
is real, but no source in the corpus states it yet. A value added before then
would invite producers to assert absence where they mean silence.

### `roast_level`

Used by `bean.roast_level`. An **ordered** scale. Unknown → ignore the field
(prefer `roast_agtron` if present).

`light` · `light_medium` · `medium` · `medium_dark` · `dark` · `extra_dark`

Six values, matching the scale specialty coffee is sold and filtered with at
retail (*Light / Light-Medium / Medium / Medium-Dark / Dark / Extra-Dark*).
`extra_dark` covers French / Italian-style roasts. A roaster's own scale name
stays in the bean's `description`. This enum carries the comparable category.

### `form`

Used by `bean.form`. Unknown → `other`.

| Value | Meaning |
| --- | --- |
| `bean` | Whole bean. |
| `ground` | Pre-ground. |
| `pod` | Sealed capsule / pod system (for example Nespresso-style). |
| `drip_bag` | Single-serve drip bag (pre-portioned, hangs on the cup). |
| `instant` | Soluble / instant coffee. |
| `other` | Any form not listed, or unknown. |

### `preferred_extraction`

Used by `bean.preferred_extraction`: the extraction style the roaster
developed the roast for, as printed on the bag ("Preferred Extraction:
Espresso"). A declared claim (tier 2), never a restriction. Any coffee can be
brewed any way. Unknown → ignore the field.

| Value | Meaning |
| --- | --- |
| `espresso` | Developed for espresso. |
| `filter` | Developed for filter / gravity brewing. |
| `omni` | Developed to work across both. |

### `origin.type`

Used by `bean.origin.type`. Unknown / absent → derive from `items.length` (one
item → `single`, more → `blend`).

`single` · `blend`

### Party `type`

Used by the [Party object](03-recipe.md#party-object)'s `type`: whether the
credited party is a `person` or an `organization`, when the source makes it
clear. Unknown or absent → **ignore the field and infer from the crediting
field**. An `author` reads as a person. A `roaster` reads as an organization.
A party whose [`role`](#producer-role) is `farm`, `cooperative`,
`washing_station` or `mill` reads as an organization. Any other role, or none,
leaves it unstated. The distinction matters chiefly to structured-data
exporters (schema.org Person vs Organization).

---

## Open registries

Open registries are curated id/alias/label data maintained beside this
specification as plain JSON in the repository's `registries/` directory. They
are served from the canonical host so any consumer can sync them:
[`gear.json`](https://coffeejson.org/registries/gear.json) ·
[`varietals.json`](https://coffeejson.org/registries/varietals.json) ·
[`addition-types.json`](https://coffeejson.org/registries/addition-types.json) ·
[`producer-roles.json`](https://coffeejson.org/registries/producer-roles.json). The
sections below state each registry's rules, with illustrative seeds. **The
JSON files are the data.** If CoffeeJSON becomes a shared standard, they are
the natural first thing to extract into a neutral, contribution-friendly
repository, so that every adopter references the same slugs (see
[Versioning § Registry governance](07-versioning.md#registry-governance)).

### Gear registry

The set of known slugs for the [Gear](03-recipe.md#gear-object) `id` field
(brewers, grinders, and baskets). Kebab-case slugs. **Non-exhaustive by
design**: `id: "custom"` plus a `label` always works, so missing coverage
never blocks a share. The canonical list is
[`registries/gear.json`](https://coffeejson.org/registries/gear.json). Each
entry carries a neutral `label`, its `roles`, a `category` where it brews, and
`brand`/`model` where unambiguous. `"custom"` is the reserved escape hatch and
not an entry.

**`roles` says where an entry attaches; `category` says how it brews.** They
are different questions and a single member answered neither cleanly.

A `brewer` attaches at [`recipe.brewer`](03-recipe.md#fields), a `grinder` at
[`grind.grinder`](03-recipe.md#grind-object), and a `basket` at
[`recipe.basket`](03-recipe.md#fields).

An **all-in-one carries more than one** — `breville-barista-express` and
`xbloom-studio` are `["brewer", "grinder"]`, because one machine fills both
slots in the same recipe. A consumer listing every brewer tests
`roles` for `brewer` rather than enumerating brew families.

Only a brewer has a `category`: `dripper` · `pour-over-machine` · `drip` ·
`immersion` · `stovetop` · `espresso-machine` · `capsule`. It overlaps
[`method`](#method) without mirroring it — `method` is the technique and
`category` is the kind of device, so `aeropress`, `french_press`, `siphon`,
`moka` and `cezve` are methods performed *with* an `immersion` or `stovetop`
device. The three devices that are easily confused: **`dripper`** is the vessel
you pour into by hand (`hario-v60`), **`pour-over-machine`** is the motor that
performs the pour for you (`xbloom-studio`), and **`drip`** is the batch filter
running one shower head over a flat bed. A grinder has no `category`, because
grinding is not a way of brewing.

`drip` and `capsule` are defined and currently carry no entry: the registry is
non-exhaustive, and a value exists here so the first such product has somewhere
to land rather than forcing a vocabulary change with it.

**An entry names a product at the granularity a source names it** — the
family (`hario-v60`, `kalita-wave`, `vst-precision`), never its sizes,
materials or generations. Those go in the Gear object's own
[`variant`](03-recipe.md#gear-object), as the maker prints them:

```json
{ "id": "hario-v60",    "variant": "02" }
{ "id": "kalita-wave",  "variant": "185" }
{ "id": "kono-meimon",  "variant": "MDN-41" }
{ "id": "vst-precision", "variant": "18 g" }
{ "id": "varia-vs3",    "variant": "Gen 2" }
```

**`variant` is free text and is never coerced to an enum.** The varying axis is
different for every family — `01`/`02`/`03`, `155`/`185`, `S`/`M`/`L`,
`XL`/`Go`, ceramic/plastic/glass, `Gen 2` — so any closed list is wrong by the
next family it meets. This is the same call [`grind.setting`](03-recipe.md#grind-object)
already makes for the same reason.

A few entries also list `aliases` — true synonyms of the same product, such as
a vendor's own name for an OEM design (`turin-df64` for `df64`) or a regional
brand name (`sage-bambino` for `breville-bambino`). **An alias is never a
variant designation.** `vst-18g` is not an alias of `vst-precision`: resolving
it would silently discard the dose, which is the one thing it says. A retired
per-variant slug is not aliased to its family for the same reason — it is
simply unrecognized, and an unrecognized id falls back correctly. A producer **SHOULD** emit the canonical `id`; a
consumer that resolves aliases matches more sources, and one that does not
still falls back correctly.

Seed entries (illustrative, not the complete list):

| Category | Example slugs |
| --- | --- |
| Drippers | `hario-v60` · `chemex` · `kalita-wave` · `origami` · `orea` · `april` · `clever-dripper` |
| Pour-over machines | `xbloom-studio` |
| Immersion | `aeropress` · `french-press` · `siphon` |
| Stovetop | `moka-pot` · `cezve` |
| Espresso machines | `breville-barista-pro` · `profitec-pro-600` · `rocket-appartamento` |
| Baskets | `vst-precision` · `ims-precision` · `pullman-876` |
| Grinders | `comandante-c40` · `1zpresso-jx` · `fellow-ode` · `baratza-encore` · `df64` |

**Matching rule.** A consumer matches on `id`. For a known `id` it **SHOULD**
substitute its own localized label, and **SHOULD** render `variant` beside it —
`variant` is the one thing the registry cannot supply, so a consumer that drops
it loses what the document knew. For `id: "custom"` or an unknown `id` it falls
back to `label`, then to `brand` / `model`. It **MUST NOT** fail on an
unrecognized `id`.

**With a known `id`, a producer SHOULD omit `brand` and `model`** — the registry
is authoritative for both, and a document that repeats them only drifts from it.
`label` keeps its own job: what the source itself called the thing, which is
worth carrying when the source wrote it in its own language
(`"ドリッパー01（V60）"`). A consumer **MAY** show that as provenance beside its
own label.

Adding a slug is a data change, not a spec change. It does not bump the format
version.

### Addition `type`

**An open registry, not a closed enum.** Unlike `kind`, `process`, or
`roast_level`, `recipe.additions[].type` has no fixed value set in the
schema. Any non-empty string is valid, so there is no "unrecognized value"
for the schema to reject. There is only a value a given consumer does or does
not have special behavior for. Recommended values, for interoperability:

`ice` · `milk` · `sugar` · `syrup` · `water` · `cream`

The canonical list is
[`registries/addition-types.json`](https://coffeejson.org/registries/addition-types.json).

`ice` is the one value with a defined effect beyond its plain meaning. Its
presence marks the whole recipe **iced** (see [Recipe §
Additions](03-recipe.md#additions)). The rest are recommended so that two
producers that describe the same addition use the same word. A producer
**SHOULD** prefer them when they apply. A consumer **MUST** accept and show
any other string generically (a flavored syrup's brand name, a bypass-water
technique with its own house term) rather than reject it.

### Producer `role`

**An open registry, not a closed enum.** `role` says what part a credited
party played, and the supply chain names more parts than any fixed list would
hold. Any non-empty string is valid. The recommended values name the parts an
origin's producers play, and are what the registry is for:

`producer` · `farm` · `cooperative` · `washing_station` · `mill` · `exporter`

The canonical list is
[`registries/producer-roles.json`](https://coffeejson.org/registries/producer-roles.json).

An origin routinely credits several parties of different kinds: a named
farmer and their farm, or a cooperative and the washing station that
processed the lot. That is why [`producers`](04-bean.md#who-produced-it) is
an array and why each entry carries its own role. `role` is an ordinary
member of the [Party](03-recipe.md#party-object) shape, so any credit may
carry one — a recipe `author` credited as the barista who developed it, a
`roaster` stating its own part — and outside `producers` the source's own
word is what a producer emits. A producer **SHOULD** prefer the recommended
values when they apply. It **SHOULD** omit `role` entirely when the source
names a party without labeling its part, rather than guess. A consumer
**MUST** show an unrecognized role beside the name rather than drop the party,
and **MUST NOT** treat a role-less entry as less real than a roled one.

`role` is about the part played, not the legal kind of party. That is
[`type`](#party-type), and the two are independent axes. Where `type` is
absent, a role of `farm`, `cooperative`, `washing_station` or `mill` implies
an organization, on whichever credit carries it.

### Varietal registry

Canonical varietal names for `bean.varietals[]`, plus an alias map from common
synonyms and breeding codes to a canonical name. The canonical data is
[`registries/varietals.json`](https://coffeejson.org/registries/varietals.json).

**Each entry says what kind of name it is.** A varietal field collects several
different botanical claims — one bred selection, a whole breeding family, an
undifferentiated local population, a species — and a flat list of names cannot
tell them apart. `Heirloom` covers thousands of Ethiopian genotypes and
`Pacamara` is one 1958 cross; a consumer grouping or filtering varietals needs
to know which it is holding.

| `kind` | What the name denotes | Registry examples |
| --- | --- | --- |
| `cultivar` | one named selection | `Bourbon` · `Gesha` · `SL28` · `Castillo` |
| `group` | a breeding family covering many selections | `Catimor` · `Sarchimor` |
| `landrace` | an undifferentiated local population | `Heirloom` · `Kurume` · `Wolisho` |
| `species` | a species named as the varietal | `Liberica` · `Robusta` · `Eugenioides` |
| `botanical_variety` | a named variety within a species | `Excelsa` · `Nganda` |
| `interspecific_hybrid` | a cross between two species | `Timor Hybrid` |
| `f1_hybrid` | a first-generation controlled cross | `H1` · `Starmaya` · `Milenio` |

`species` carries the botanical epithet the name is sold as — `arabica` ·
`canephora` · `liberica` · `eugenioides` · `stenophylla` · `racemosa` ·
`charrieriana` · `congensis`, and `a-x-b` for a true cross. **An arabica
cultivar carrying Timor Hybrid ancestry is `arabica`**, because that is what it
is botanically and commercially: `Catimor`, `Castillo`, `Colombia`, `Lempira`,
`Marsellesa`, `Parainema`, `Batian` and `Ruiru 11` are all `arabica`, and only
`Timor Hybrid` itself is the cross.

**Both members are optional.** A name whose parentage is genuinely disputed
omits the key rather than guessing, because a forced guess is worse data than a
stated gap. Every row here carries both where they are settled.

Both members are **annotations on the match, never a constraint on a document**.
`bean.varietals[]` stays an array of strings, a producer emits what the roaster
claimed, and a consumer that ignores `kind` and `species` entirely behaves
exactly as before. The `kind` set is open: an unrecognized value is ignored, not
an error.

Canonical examples: `Bourbon` · `Caturra` · `Catuai` · `Typica` · `Gesha` ·
`SL28` · `SL34` · `Heirloom` · `Pacamara` · `Pacas` · `Mundo Novo`.

Alias examples (alias → canonical):

| Alias / code | Canonical |
| --- | --- |
| `Geisha` | `Gesha` |
| `ゲイシャ` | `Gesha` |
| `ブルボン` | `Bourbon` |
| `BM139` | `Batian` |
| `CAT129`, `Nyika` | `CAT129` (a.k.a. Nyika) |
| `H1`, `Centroamericano` | `H1` |

A producer **SHOULD** emit a canonical name when it knows one. A consumer that
does not recognize a value **MUST** pass it through unchanged. Varietal
coverage is open-ended, and a dropped unknown varietal loses real
information.

**Aliases carry scripts, not just spellings.** A roaster that publishes in
Japanese writes `ゲイシャ`, `ブルボン`, `ティピカ` and gives no Latin original.
A document that records what the page said is then unreachable by a consumer
that filters for Geisha, Bourbon or Typica. The alias map closes that gap
without anyone translating. **The document keeps the source's own value**, and
matching happens against the registry. That distinction matters. A
transliteration at transcription time would be authoring, and it is lossy in
one direction (katakana cannot round-trip a producer's accents). So it is the
consumer's lookup that normalizes, never the producer's pen.

### Flavor descriptors

What a drinker tasted, for [`tasting.descriptors[]`](05-tasting.md#fields):
`blackberry`, `floral`, `dark chocolate`.

**Free strings, and uncurated by design.** CoffeeJSON ships no descriptor list
and reserves none. A producer emits the words its users chose. A consumer
**MUST** pass every descriptor through and show it verbatim rather than drop,
tokenize or rewrite it. "Smells like my grandmother's kitchen" lost to a
controlled vocabulary would lose the only part of a tasting the drinker cared
about.

A descriptor is **display text, not an id**. It carries spaces and the
source's own casing, `dark chocolate` rather than `dark_chocolate`, and the
`snake_case` token rule above does not reach it.

**Comparing two descriptors.** A consumer that needs to know whether two
descriptors are the same (to match a cup against another, or filter a
library) compares them by **folding case and trimming leading and trailing
whitespace**, and nothing further. `Dark Chocolate`, `dark chocolate` and
`  dark chocolate ` are one descriptor. `dark-chocolate` is a different one.
No stemming, no synonym table, no punctuation stripping. Each of those would
be a consumer inventing a vocabulary the format declined to ship, and two
consumers that invent different ones is exactly the failure this rule exists
to prevent. Whatever the comparison decides, what is **stored and displayed**
is still the string the document carried.

Two things this vocabulary is not. It is **not** a mapping onto a published
sensory lexicon. Aligning descriptors to an industry flavor wheel is a
[reserved extension](07-versioning.md#reserved-extensions), not something a
producer attempts at authoring time. And it is **not**
[`bean.roaster_notes`](04-bean.md#roaster-notes). Those are the roaster's
claim about a coffee. These are one drinker's impression of one cup, and a
consumer **MUST NOT** merge them.

### Drying method

`bean.drying_method` records how the coffee was dried (for example
`raised_bed`, `patio`, `covered_patio`, `mechanical`), distinct from
`process`. **No controlled vocabulary in v1.0.** It is a free string. A
consumer renders it (for example by Title-casing a slug) and **MUST** pass an
unrecognized value through unchanged. A future registry may curate common
methods. Adding one is a data change, not a version bump.

### Certifications

`bean.certifications[]` carries roaster-declared certification /
production-claim strings (for example `organic`, `fair_trade`,
`rainforest_alliance`, `kosher`, `biodynamic`). **No controlled vocabulary in
v1.0.** They are free strings, a *stated* claim, never an independent audit.
A consumer **MUST** pass unknown values through unchanged. A future registry
may normalize common claims.

### Country codes

`bean.origin.items[].country` uses
[ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1): two uppercase
letters, for example `ET` (Ethiopia), `CO` (Colombia), `KE` (Kenya), `BR`
(Brazil), `GT` (Guatemala), `PA` (Panama), `ID` (Indonesia).

This is an external standard, not a CoffeeJSON-curated list. The codes are
stable and every platform ships a localization for them, so a consumer
renders the country name in its own locale from the code. A value that is not
a valid ISO code **SHOULD** be passed through verbatim rather than dropped.

Continent / region-group facets (*Africa*, *Central America*, …) are
**derived** by consumers from the code. CoffeeJSON carries no continent
field.
