# Bean

A **Bean** describes the identity of a coffee: where it comes from, how it was
processed, how it was roasted, and what the roaster says it tastes like. In
v1.0 a Bean is a **top-level entity**, carried as an element of the `beans`
array in the [document envelope](02-envelope.md). A one-element `beans` array
shares a single coffee. A multi-element array carries a catalog of distinct
coffees. Both are independent of any recipe. When a one-element `beans` array
is co-located with `recipes`, those recipes are *for* that coffee. This is the
[bag-to-brew](02-envelope.md#association-co-location) case: the coffee and the
way to brew it in one document.

A **blend is one Bean**, a single element of `beans`. It is expressed as an
[origin](#origin-object) of `type: "blend"` with several `items`, or with no
`items` at all when the components are not published. A multi-element `beans`
array is for several *distinct* coffees, never the components of a single
blend.

Every field is optional. A Bean can be as thin as a roaster name or as rich as
a full origin record. It carries no inventory or personal state (principle 4,
[Overview](01-overview.md)): no bag weight, no purchase date, no personal
rating.

```json
{
  "name": "Nano Challa",
  "roaster": { "name": "Example Roastery" },
  "url": "https://example.com/coffees/nano-challa",
  "origin": {
    "type": "single",
    "items": [
      {
        "country": "ET",
        "region": "Guji",
        "producers": [{ "name": "Nano Challa cooperative", "role": "cooperative" }],
        "altitude": { "min": 1900, "max": 2100, "unit": "meter" },
        "harvest_time": "Oct–Dec 2025"
      }
    ]
  },
  "process": ["washed"],
  "drying_method": "raised_bed",
  "varietals": ["Heirloom"],
  "roast_level": "light_medium",
  "roast_agtron": 65,
  "roast_date": "2026-06-20",
  "decaf": false,
  "form": "bean",
  "preferred_extraction": "filter",
  "certifications": ["organic", "fair_trade"],
  "roaster_notes": ["blueberry", "dark chocolate", "floral"],
  "description": "A juicy washed heirloom lot — bright, floral, and honey-sweet."
}
```

## Fields

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `id` | string | no | Document-scoped identifier so a recipe can reference this bean via [`bean_ref`](03-recipe.md#bean_ref). Needed only in multi-bean documents. See [`id`](#id). |
| `name` | string | no | The coffee's product name. |
| `roaster` | [Party](03-recipe.md#party-object) | no | The roasting company, as a party — `{ name, url?, type? }`. Absent `type` defaults to organization by role. |
| `url` | string (URI) | no | The roaster's canonical product page for this coffee. A reference/pointer, **not** a claim about the coffee — see [Provenance tiers](#provenance-tiers-within-bean). |
| `images` | array of string (URI) | no | Image URLs for the coffee — typically the roaster's product photography. Always an array; omit or empty when none. Reference metadata, like `url`. |
| `origin` | [Origin](#origin-object) | no | Single origin or blend. |
| `process` | array of string (enum) | no | Post-harvest processes — a **set** (order as stated, not significant). See [`process` vocabulary](06-vocabularies.md#process) and [Processes are a set](#processes-are-a-set). |
| `drying_method` | string | no | Post-harvest **drying** method, distinct from `process` (for example `raised_bed`, `patio`, `mechanical`). Free string. See [Drying method](#drying-method). |
| `varietals` | array of string | no | Canonical varietal names / slugs. See [Varietals](#varietals). |
| `roast_level` | string (enum) | no | `light` · `light_medium` · `medium` · `medium_dark` · `dark` · `extra_dark`. |
| `roast_agtron` | number | no | Agtron Gourmet number, 0–100 (light-high: ~95 very light … ~25 very dark) — the measurable counterpart to `roast_level`. |
| `roast_date` | string (ISO 8601 date) | no | for example `"2026-06-20"`. |
| `rest_days` | object | no | `{ min?, max? }` — the window, in days from roast, in which the roaster recommends brewing. See [Rest window](#rest-window). |
| `production_roaster` | string | no | The roasting **machine** the coffee is produced on, as printed (for example `"Diedrich CR-70"`). Free string. See [Production roaster](#production-roaster). |
| `decaf` | boolean | no | A coffee attribute, not inventory. Absent = unstated; `false` is the explicit claim that the coffee is not decaf. |
| `form` | string (enum) | no | Physical form the coffee is sold/prepared in: `bean` · `ground` · `pod` · `drip_bag` · `instant` · `other`. Unknown → `other`. See [`form` vocabulary](06-vocabularies.md#form). |
| `preferred_extraction` | string (enum) | no | `espresso` · `filter` · `omni` — the style the roaster developed the roast for. See [Preferred extraction](#preferred-extraction). |
| `certifications` | array of string | no | Roaster-declared certifications / production claims (for example `organic`, `fair_trade`, `rainforest_alliance`). Free strings. See [Certifications](#certifications). |
| `roaster_notes` | array of string | no | Tasting descriptors **as claimed by the roaster**. See [Roaster notes](#roaster-notes). |
| `description` | string | no | The roaster's own prose about the coffee, as written. Human text. See [Description](#description). |
| `lang` | string (BCP-47) | no | Language of the Bean's human text fields (`description`, free-text notes). Same well-formed BCP-47 tag as on the [Recipe](03-recipe.md). A hint only. |
| `localizations` | object | no | The roaster's own translations of this coffee's human text, keyed by BCP-47 tag — the bilingual bag. Requires `lang`. See [Localizations](#localizations). |

## Provenance tiers within Bean

A Bean spans two of the format's three [provenance tiers](01-overview.md#how-the-data-is-modeled):

- **Tier 2 — declared claims** (roaster claims): `origin` (including each
  item's `name`, `process`, `harvest_time`, and blend `percentage`), `process`,
  `drying_method`, `varietals`, `roast_level`, `roast_agtron`, `roast_date`,
  `rest_days`, `production_roaster`, `decaf`, `form`, `preferred_extraction`,
  `certifications`. These are normalized to factual, queryable forms (ISO
  country codes, meters, the Agtron number, an ISO date). They remain
  *claims* on the bag: normalized, not independently verified.
  `certifications` in particular is a *stated* claim, never an independent
  audit.
- **Tier 3 — attributed subjective** (sensory): `roaster_notes` and
  `description`, always attributed to the roaster, never asserted as bare fact.

`id`, `url`, `images`, and `lang` sit **outside** the tiers. They are reference
metadata, not a fact, claim, or opinion *about the coffee*. `id` is a
document-local handle so a recipe can point at this bean ([below](#id)).
`url` is a pointer to the roaster's product page and `images` to its product
photography. A consumer can follow them or ignore them. They assert nothing
about the coffee's identity or taste. `lang` hints the language of the human
text fields, as on the Recipe.

A drinker's *personal* rating is Tier 3 too, but CoffeeJSON does **not** carry
it (principle 4: that is personal state, not the coffee's identity).

### `id`

`id` exists for exactly one job: it lets a recipe in the **same document**
name this bean via [`bean_ref`](03-recipe.md#bean_ref). It is necessary only
when `beans` carries several coffees, because a single co-located bean needs
no identifier (see [Envelope § Association](02-envelope.md#association-co-location)).

- Any non-empty string is a valid `id`. A short slug (`"nano-challa"`) reads
  well in a URL-embedded document, but no format is imposed.
- Every `id` present **MUST** be unique within the document's `beans` array,
  compared **case-sensitively**. If several beans share an id, the document is
  malformed. A consumer **MUST NOT** fail, and **SHOULD** treat references to
  that id as unresolved.
- An `id` is a **local label, not an identity**. It implies no registry and
  no account, and it is not stable across documents. Two documents can reuse
  the same string for different coffees. Anything that would only make sense
  as a global key is inventory state and out of scope (principle 4,
  [Overview](01-overview.md)).

### Roast level and Agtron

`roast_level` is the categorical claim (`light` … `extra_dark`).
`roast_agtron` is the measurable counterpart on the Agtron Gourmet scale. They
are complementary, not redundant. A producer **MAY** emit either or both. When
both are present and they disagree, a consumer **SHOULD** prefer
`roast_agtron` for any numeric comparison and use `roast_level` for display.
It **MUST NOT** reject the document.

The six values follow the scale specialty coffee is sold and filtered with at
retail. Marketplace facets run *Light / Light-Medium / Medium / Medium-Dark /
Dark / Extra-Dark*. A roaster's own scale name ("Expressive Dark") is not
normalized away. It stays in `description`, and `roast_level` carries the
comparable category.

A roaster's own *number* is treated the same way, and the rule is stricter
because the failure is silent. `roast_agtron` carries a value stated on the
Agtron Gourmet scale and nothing else. A bounded house dial, or an
Agtron-derived scale the roaster describes as adapted, is a different
measurement in the same shape. A producer **MUST NOT** emit it in this field.
The hazard is that such a number often falls *inside* 0–100 and so validates.
No consumer can tell it from a Gourmet reading, and the two commonly disagree
about which end of the scale is dark. Omit the field unless the source states
the scale, and keep the roaster's figure in `description` in their words. A
house number is comparable only within that one roaster's catalog, so
nothing comparable is lost. Trade names ("Full City+"), house scale names, and
marketplace tiers all resolve to `roast_level` by the roaster's own stated
intent. This specification publishes no conversion table, because none is
authoritative. Trade names have no governing body, roasters disagree, and
Agtron readings vary with sample preparation.

### Rest window

Roasters publish when to drink a coffee, not only when it was roasted. Often it
is a labeled field on every bag (`エイジング`, "aging"), sometimes a sentence
("rest at least 14 days"). It is a brewing precondition, and it is not
derivable from `roast_date`. How long a coffee needs to degas depends on the
roast and the roaster's judgment, not on the calendar.

```json
"rest_days": { "min": 14 }
```
```json
"rest_days": { "min": 14, "max": 60 }
```

Both bounds are day counts from `roast_date`, and at least one **MUST** be
present. `min` is the degassing period. Brew before it and the coffee is still
outgassing. `max` is where the roaster stops recommending it. A roaster who
states only one bound states only one. Nothing is inferred from the other end.

A roaster can publish a *peak* inside a wider limit ("best at 2–3 weeks,
good within 2 months"). The bounds carry the recommended window, and the peak
stays in `description`. The format carries the window the roaster stands
behind, not a three-point curve.

This is the coffee's own claim about itself, not a shelf life. It says nothing
about a particular bag's age, which would be inventory state (principle 4).

### Production roaster

`production_roaster` names the roasting **machine** the coffee is produced on:
`"Diedrich CR-70"`, `"Loring S70 Peregrine"`, `"Probat P25"`. Roasters
increasingly print it beside process and drying method as production
provenance. It is a Tier-2 declared claim and a **free string** in v1.0 (no
machine registry). It is distinct from `roaster`, the company. A consumer
shows it verbatim or ignores it.

### Preferred extraction

`preferred_extraction` states what the roaster **developed the roast for**:
`espresso`, `filter`, or `omni` (both, on purpose). Roasters increasingly
print it as a structured attribute ("Preferred Extraction: Espresso"), and
bean-importing apps model the same concept (Beanconqueror's *bean roasting
type*). It is a Tier-2 **declared claim about intent**, never a restriction.
Any coffee can be brewed any way. It says nothing about which co-located
recipe to prefer. That is the recipe's
[`recommended`](03-recipe.md#recommended) flag. Unknown value → ignore the
field. See
[Vocabularies § `preferred_extraction`](06-vocabularies.md#preferred_extraction).

### Varietals

`varietals` is an array of canonical varietal names or slugs, for example
`Bourbon`, `Caturra`, `Catuai`, `Typica`, `Gesha`, `SL28`, `Heirloom`,
`Pacamara`. A shared registry maps aliases and breeding codes (for example
`BM139`, `CAT129` / `Nyika`, `H1`) to a canonical name. A consumer that does
not recognize a value **MUST** pass it through unchanged rather than drop it.
See [Vocabularies § Varietal registry](06-vocabularies.md#varietal-registry).

### Roaster notes

`roaster_notes` are tasting descriptors **as claimed by the roaster**: a
Tier-3 attributed claim, never a bare assertion that the coffee *is*
blueberry. In v1.0 they are free strings. A later revision may align them to
the Coffee Taster's Flavor Wheel lexicon, published by the Specialty Coffee
Association and World Coffee Research (see [Versioning § Reserved
extensions](07-versioning.md#reserved-extensions)). Until then, a consumer
**MUST** accept arbitrary strings.

`roaster_notes` is distinct from a structured cupping score, which is a
reserved `tasting` extension and not part of v1.0.

### Description

`description` carries the roaster's own prose about the coffee, the paragraph
on the bag or product page, **as written**. Like `roaster_notes` it is Tier-3
attributed text: the roaster's voice, never normalized, never asserted as
fact. A consumer **SHOULD** show it attributed, because it is marketing prose,
not a neutral summary. It **MUST NOT** parse it for structured data the
document also carries elsewhere. `lang` hints its language. Structured facts
(origin, process, notes) belong in their own fields, not only in the prose.

### Drying method

`drying_method` records **how the coffee was dried** after processing, for
example `raised_bed` (African / raised beds), `patio`, `covered_patio`,
`mechanical` (guardiola / drum). It is distinct from `process`, the
post-harvest ferment/wash decision. Two washed coffees can be patio-dried and
raised-bed-dried, and roasters increasingly print it as structured provenance
rather than prose. In v1.0 it is a **free string** with no controlled
vocabulary. A consumer that does not recognize a value **MUST** pass it
through unchanged. A later revision may introduce a `drying_method` registry,
a data change rather than a version bump (see [Versioning § Registry
governance](07-versioning.md#registry-governance)).

### Certifications

`certifications` is an array of **roaster-declared** certification or
production-claim strings, for example `organic`, `fair_trade`,
`rainforest_alliance`, `kosher`, `biodynamic`, `regenerative_organic`. In v1.0
they are **free strings**. A later vocabulary may normalize common claims. A
certification here is a *stated claim on the bag* (Tier 2), never an
independent audit. A consumer **MUST NOT** present it as verified, and
**MUST** pass unknown values through unchanged.

### Localizations

The bilingual bag: a roaster who prints the same coffee in two languages
carries the second in `localizations`, keyed by BCP-47 tag. A Bean
localization carries `name`, `description`, and `roaster_notes`, the roaster's
*wording*.

```json
{
  "name": "エチオピア イルガチェフェ",
  "lang": "ja",
  "roaster": { "name": "Example 焙煎所" },
  "origin": { "items": [ { "country": "ET", "region": "Yirgacheffe", "process": ["washed"] } ] },
  "roaster_notes": ["ジャスミン", "ピーチ", "紅茶"],
  "localizations": {
    "en": {
      "name": "Ethiopia Yirgacheffe",
      "roaster_notes": ["Jasmine", "Peach", "Black tea"]
    }
  }
}
```

The shared rules are stated once under [Recipe §
Localizations](03-recipe.md#localizations) and apply here unchanged. Those
are: `lang` required, only the publisher's own translation, BCP-47 lookup
matching, and no non-text member in the authoring schema. What is specific
to a Bean:

- **The coffee's identity never varies.** `origin`, `process`, `varietals`,
  `roast_level`, `altitude`, and dates never appear in a localization. None of
  them change with the language the bag is printed in. A Yirgacheffe is grown
  in the same place in every language.
- **`roaster_notes` is replaced whole, not matched item by item.** Descriptor
  lists get rewritten in translation rather than mapped one-to-one. A roaster
  who prints four notes in Japanese and three in English has published exactly
  that. Pairing them by position would invent a correspondence they never
  claimed. This is the one exception to the positional rule for a recipe's
  `steps`. There, position *is* the correspondence: step 2 is step 2 in every
  language.

---

## Origin object

```json
{
  "type": "single",
  "items": [
    { "country": "CO", "region": "Huila", "producers": [{ "name": "…" }], "altitude": { "min": 1700, "max": 1900, "unit": "meter" } }
  ]
}
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `type` | string (enum) | no | `single` · `blend`. Defaults to `single` when there is one item, `blend` when there are several. State it explicitly when `items` is absent, where it carries the only origin fact known. |
| `items` | array of [OriginItem](#originitem-object) | no | One item for a single origin; several for a blend (proportions may be unknown). Omit when the components are not published; an absent `items` means **unknown**, never none. |

`type` is a convenience label. A consumer **SHOULD** derive the effective type
from `items.length` when `type` is absent (one item → single, more → blend).

Both can be omitted independently, and `type` alone is a complete statement.
Blends routinely do not publish their component origins. A producer that knows
only "this is a blend" **MUST** be able to say exactly that, as
`{ "type": "blend" }`. It does not invent components or discard the fact.
This is the one case where `type` is not derivable and so not redundant.

An **empty** `items` array is invalid. Absent and empty would otherwise be two
spellings of the same claim, and the honest one is absence. A producer that
publishes no components has nothing to assert. It does not assert that there
are none.

## OriginItem object

```json
{ "country": "ET", "region": "Guji", "producers": [{ "name": "Tesfaye Bekele", "role": "producer", "type": "person" }, { "name": "Nano Challa", "role": "cooperative" }], "altitude": { "min": 1900, "max": 2100, "unit": "meter" }, "harvest_time": "Oct–Dec 2025" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `name` | string | no | The component coffee / lot **as the roaster labels it** (for example `"Alaka G1"`). Useful in blends whose components are named coffees. |
| `country` | string (ISO 3166-1 alpha-2) | no¹ | Country of origin — factual, normalizable, localizable. For example `ET`, `CO`. |
| `region` | string | no | Growing region **as the source states it**, at whatever granularity that is — usually within a country (`Guji`, `Huila`), sometimes broader than one (`East Africa`). |
| `producers` | array of [Party](03-recipe.md#party-object) | no | The parties credited with producing this component, each with an optional `role`. See [Who produced it](#who-produced-it). |
| `altitude` | [Altitude](#altitude-object) | no | Altitude above sea level as a unit-bearing value or range. |
| `varietals` | array of string | no | This component's coffee varieties, as the roaster names them — the per-component counterpart of [`bean.varietals`](#varietals), for blends whose components differ. |
| `process` | array of string (enum) | no | This component's post-harvest processes — same [vocabulary](06-vocabularies.md#process) as `bean.process`. For blends whose components are processed differently, and for a component that underwent more than one. |
| `harvest_time` | string | no | Harvest period as stated by the roaster — a free string (for example `"2025"`, `"Oct–Dec 2024"`). |
| `percentage` | number | no | This component's share of a **blend**, `0`–`100`. Meaningful only when the origin has several `items`; omit for a single origin. |

¹ All fields are optional, but an item **SHOULD** carry at least `country`.
An origin item with no country conveys little and is hard to localize.

The exception is a source that names no country itself. A roaster who writes
only "East Africa" has named a real growing region that spans several
countries. An inferred code would assert a precision they did not, and a
dropped component would turn a two-component blend into a single origin.
Record what the source states, usually `region`. Accept that it renders in
one language. **Never invent a `country` to satisfy this SHOULD.**

`region` carries the growing region **at whatever granularity the source
states it**, and the variance runs in both directions. It is usually
sub-national (`Guji`, `Huila`), sometimes supra-national (`East Africa`,
`Central and South America`). Sometimes it is narrower than a country in a way
that still names no country: an island (`Sumatra`) listed where the sibling
components name states. All three are well-formed, and all three can appear
without `country`. A consumer that groups by country will find items with no
country for both reasons: the source was too broad, or too narrow. Both are
faithful records, and neither is an error to repair.

`country` uses [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1)
codes (two uppercase letters). This is the one origin field that is fully
factual and localizable. `ET` renders as "Ethiopia", "エチオピア", or "Etiópia"
depending on the consumer's locale. See
[Vocabularies § Country codes](06-vocabularies.md#country-codes).

### Who produced it

A coffee's origin usually credits **more than one party**, and they are
different kinds of thing. A roaster names a farmer *and* their farm, or a
cooperative *and* the washing station that processed the lot. Sometimes a
mill or an exporter is named as well. Sources that label their own fields
make the distinction explicit. Japanese pages routinely print 生産者 (producer)
beside 農園 (farm) as separate rows.

So `producers` is an array of [Party](03-recipe.md#party-object) entries, each
with an optional `role`. It is the same object a roaster or a recipe author
is, so a consumer renders one with the code it already has:

```json
"producers": [
  { "name": "Edgardo Tinoco", "role": "producer", "type": "person" },
  { "name": "Pino de Oro", "role": "farm" }
]
```

- **Order is the source's.** No entry is "primary". A consumer that shows one
  shows the first and **SHOULD** keep the rest reachable.
- **`role` is omitted when the source does not label the party.** That is
  common, and honest. An entry that is only `{ "name": "Finca Las Brisas" }`
  says exactly what the page said, no more.
- **`role` is an [open registry](06-vocabularies.md#producer-role)**, so a
  supply chain that names a part this list does not cover needs no spec
  revision. A consumer shows an unrecognized role beside the name rather than
  drop the party.

### Processes are a set

`process` is a **list**, on the bean and on each origin item, because sources
routinely state more than one and a single value cannot carry them:

```json
"process": ["anaerobic", "honey"]
```

Two readings, one field:

- **One coffee, several processes.** A bag that states "Double Anaerobic
  Honey" had an anaerobic fermentation *and* a honey drying. `honey` alone is
  true but incomplete. The coffee becomes indistinguishable from a plain honey
  in any search, which is exactly what the roaster was selling against.
- **A blend, stated at bag level without assignment.** A roaster prints
  "Process / Washed, Natural" for a three-origin blend. That says the bag
  contains coffee of each, without saying which component is which. The
  bag-level list is that claim exactly. The items stay silent rather than
  invent an assignment.

Both are true statements of the same shape, *these processes are present in
this coffee*. Which reading applies is answered by the
[origin](#origin-object), not by this field. A single element is the common
case and needs no thought.

**Order carries no meaning.** Publishers state the parts in whatever order
they like, and it is rarely the order they happened in. One bag writes
"Double Anaerobic Honey" (fermentation first). Another writes "ナチュラル、アナロビック"
(drying first) for the same shape of coffee. A consumer **MUST NOT** read the
first element as primary.

When a blend's components differ, a washed Colombia beside a natural Ethiopia,
the difference belongs on the **item**. Item-level `process` and `varietals`
state each component's own, and `name` carries the component's label. A blend
that names eight varieties across four components has them on the
components. A single bean-level list would assert an eight-variety mixture
the roaster never claimed. Bean-level `process` remains the bag-level claim
about the coffee as a whole. When both are present and disagree, the item is
the more specific claim.

Components can also be stated at different **granularities**, because roasters
describe them that way. Here one component is a country and its department.
The other is a region the roaster names without naming a country:

```json
"origin": { "type": "blend", "items": [
  { "country": "CO", "region": "Huila", "process": ["washed"] },
  { "region": "East Africa", "process": ["natural"] }
]}
```

Both items are well-formed. A consumer that renders origin treats `region`
and `country` as independently optional. It does not assume `region`
qualifies a country that is present.

## Altitude object

Altitude uses the same unit-identifier principle as
[Measurement](03-recipe.md#measurement-object). It permits ranges because
coffee origins are commonly listed as elevation bands.

```json
{ "value": 1900, "unit": "meter" }
```

```json
{ "min": 1700, "max": 1900, "unit": "meter" }
```

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `value` | number | one of | A single elevation. |
| `min` | number | one of | Lower bound for an elevation range. |
| `max` | number | one of | Upper bound for an elevation range. |
| `unit` | string | yes | Length unit identifier: `meter` or `foot`. |

An Altitude object **MUST** contain `unit` and at least one of `value`, `min`,
or `max`. Producers **SHOULD** emit `meter`. `foot` is allowed for sources
that state elevation in feet. Consumers **MUST** convert any recognized
altitude unit to their canonical store and localize display at the edges.
