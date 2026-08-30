# Tasting

A **Tasting** is how one brewed cup turned out: the outcome of following a
recipe, not the recipe itself. It is the third top-level entity of CoffeeJSON
v1.0, carried as an element of the `tastings` array in the [document
envelope](02-envelope.md) beside [Recipe](03-recipe.md) and
[Bean](04-bean.md). It points back at what it evaluates: a
[`recipe_ref`](#fields) at the brew, a [`bean_ref`](#fields) at the coffee.
Both are optional and both resolve independently. See
[Envelope § Association (a tasting's recipe and coffee)](02-envelope.md#association-a-tastings-recipe-and-coffee).

Unlike `beans` and `recipes`, a `tastings` array does **not** on its own make
a valid document. A tasting evaluates something, so a document that carries
only tastings describes nothing a consumer can act on.

```json
{
  "recipe_ref": "morning-v60",
  "rating": 4,
  "perceived": { "extraction": -0.2, "strength": 0.1 },
  "descriptors": ["blackberry", "floral"],
  "note": "best one this week",
  "measured": { "tds": 1.38 }
}
```

Every field is optional. A tasting can be as thin as a single refractometer
reading or as rich as a full impression with a note in the drinker's own
words.

A tasting is **not a journal entry**. It carries no timestamp, no personal
identity, and no inventory state. It says how a cup was, not who drank it or
when.

## Fields

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `id` | string | no | Document-local name for this tasting, so something outside the `tastings` array can say which one it means. Unique within `tastings`, compared exactly. See [Tasting `id`](#tasting-id). |
| `recipe_ref` | string | no | The [`id`](03-recipe.md#id) of a recipe in this document — the brew this cup came from. Exact, case-sensitive. An unresolved reference leaves the tasting unlinked; consumers **MUST NOT** fail. |
| `bean_ref` | string | no | The [`id`](04-bean.md#id) of a bean in this document — the coffee that was brewed. Same matching and failure rules. |
| `rating` | integer | no | 1–5, how much the drinker liked **this cup**. See [`rating`](#rating). |
| `perceived` | object | no | How the cup was perceived, on the two dial-in axes. See [Perceived](#perceived). |
| `descriptors` | array of string | no | What the drinker tasted, in the drinker's own words. Free strings, displayed verbatim — see [Flavor descriptors](06-vocabularies.md#flavor-descriptors) for the comparison rule. |
| `note` | string | no | The drinker's own words. Producers that treat notes as private **SHOULD** omit the field rather than emit an empty string. |
| `lang` | string (BCP-47) | no | Language of this tasting's human text (`note`, `descriptors`), as a well-formed BCP-47 tag. A hint only. See [Tasting `lang`](#tasting-lang). |
| `measured` | object | no | What an instrument read. See [Measured](#measured). |

## Impression and measurement are kept apart

The split down the middle of this object is by design. `rating`, `perceived`
and `descriptors` are **attributed opinion**: one drinker, one cup, one
occasion. `measured` is **measured fact**: an instrument reading anyone with
the same instrument would reproduce. They are never mixed, and a consumer
**MUST NOT** present one as the other.

This is why a `rating` is permitted at all. CoffeeJSON does not carry quality
scores for a coffee. `rating` is not "this coffee is a 4". It is "the person
who wrote this file liked this cup" — the impression belongs to whoever
produced the document, scoped to one brew, and never comparable across
producers. [`generator`](02-envelope.md#generator) is optional and names
software, not a drinker: a consumer **MAY** show it as a courtesy and **MUST
NOT** read it to decide whose impression this is.

## Tasting `id`

A document-local name for one tasting, exactly as a recipe's
[`id`](03-recipe.md#id) is for one recipe. It is any non-empty string, unique
within the document's `tastings` array, compared **exactly and
case-sensitively**. It is never a global identifier, an account, or an
inventory key.

It exists for the same reason: **array position is not an identity.** Three
tastings of one recipe are otherwise an unordered bag. Only their position
tells them apart. This specification never declares position authoritative for
`tastings`, as it does for [`steps`](03-recipe.md#step-object). A document
regenerated with one cup added in the middle silently renames every tasting
after it.

- **Optional, and worth emitting whenever a document carries more than one
  tasting.** A single tasting needs no id.
- **Producers SHOULD keep an id stable** across re-publication of the same
  cup.
- Uniqueness is a semantic rule JSON Schema cannot express. A validator
  **SHOULD** show a duplicate as a warning. A consumer that resolves a
  reference to a duplicated id **SHOULD** treat it as unresolved.

An `id` is **not a timestamp**. A tasting still carries no time of brewing
and no drinker identity. Naming a cup is not dating it.

## Tasting `lang`

The BCP-47 tag that hints what language this tasting's human text is in: its
[`note`](#fields) and its `descriptors`, both the drinker's own words. It has
the same form and the same status as a recipe's
[`lang`](03-recipe.md#fields): a well-formed tag, hyphen-separated, and a
**hint only**.

A tasting has **no `localizations`** counterpart, and will not get one. A
recipe's localizations exist because a publisher translates work meant for an
audience. A tasting is one person's account of one cup, and nobody publishes
translations of their own tasting note. A producer with the same cup
described in two languages has two tastings, not one with an overlay.

## `rating`

An integer **1–5**. The scale is declared here rather than left to the
schema's bounds. A score whose system is unstated is a number a consumer can
only misread.

**Importing from another scale.** A producer whose own rating runs on a
different system maps to the **nearest whole value in 1–5**. A 10-point score
halves and rounds. A half-star scale rounds away from zero. A three-tier
like/neutral/dislike takes 5, 3 and 1. Some scales **cannot** be mapped: an
unbounded score, or a scale with no "worse" and "better". Such a producer
**MUST** omit `rating` rather than emit a value that reads as a comparable
star count.

The field stays an integer. Widening it to accept halves later is additive
and costs no existing document. Narrowing a number back to an integer would
break every document that used a fraction. So the tighter shape is the one
that keeps the choice open.

## Perceived

Both axes run **-1 to 1** with `0` meaning "about right":

| Axis | -1 | 0 | +1 |
| --- | --- | --- | --- |
| `extraction` | sour, acidic, under-extracted | balanced | bitter, harsh, over-extracted |
| `strength` | weak, watery, thin | about right | strong, heavy, muddy |

These are **impressions, not readings**. `perceived.extraction` is what the
drinker tasted. It is not an extraction yield and **MUST NOT** be derived
from one or rendered as a percentage.

The member is named for its provenance, *perceived*, as against
[`measured`](#measured), and not for its shape. So it can hold a third
dimension without its name becoming false. One consequence is worth stating
rather than designing away: the **-1 to 1 bipolar scale is a property of
these two dimensions, not of the member**. `extraction` and `strength` are
directions with a correct middle. A perceived *intensity* (body, sweetness)
would be a magnitude with no such middle, so it would carry its own scale. A
consumer **MUST NOT** assume every member of `perceived` runs -1 to 1.

**Why not `axes`.** The two dimensions are still axes, and this document
still calls them that. But a member named for them describes its shape, which
is the half that will not survive. The day a perception arrives that is not a
dial-in axis, it either goes somewhere else or makes the member's name a lie.
The first gives "how it tasted" two homes. `perceived` says what the values
are, which is what every consumer needs to know before rendering one.

## Measured

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `tds` | number | no | Total dissolved solids in the beverage, as a **percentage by mass**, as read by a refractometer. Greater than 0. |
| `yield` | [Measurement](03-recipe.md#measurement-object) (mass) | no | Beverage mass actually **weighed** out of this brew. A scale reading of this cup, not the recipe's target. See below. |

Filter coffee usually lands near 1.2–1.6 and espresso near 8–12. The schema
does not bound `tds` to those ranges. Concentrates and cold brew exceed them,
and a schema that rejected a true reading would be worse than one that
accepts a surprising one.

**Two beverage masses, and which one wins.** A recipe's
[`yield`](03-recipe.md#fields) is the mass the brew *aimed at*.
`measured.yield` is the mass that *came out*, weighed. They are different
facts, and the format carries both. A cup that landed at 258 g against a
262 g target is a 258 g cup, and only the tasting can say so. That matters
most where a recipe has no `yield` at all, the normal case for immersion
brewing stated by water.

**Extraction yield is not a field.** It is derived. Carried as well, the same
quantity would have two homes that can disagree:

```
extraction yield % = (beverage mass × TDS %) ÷ dose
```

A consumer that computes it takes the beverage mass from **`measured.yield`
when the tasting carries one, and the recipe's [`yield`](03-recipe.md#fields)
otherwise**: the measurement of this cup before the target it was brewed
against. The dose is the recipe's [`coffee`](03-recipe.md#fields). A consumer
that lacks any of the three **MUST NOT** guess. Beverage mass and dose come to
one mass unit — grams — before they divide; an operand stated by volume, or in
a unit the consumer does not recognize, yields **no** number; and a window is
reduced only under [Recipe § Stated
windows](03-recipe.md#stated-windows).

## Example

```json
{
  "coffeejson": "1.0",
  "recipes": [
    {
      "id": "morning-v60",
      "title": "Morning V60",
      "method": "pour_over",
      "coffee": { "value": 18, "unit": "gram" },
      "water": { "value": 300, "unit": "gram" },
      "yield": { "value": 262, "unit": "gram" }
    }
  ],
  "tastings": [
    {
      "recipe_ref": "morning-v60",
      "rating": 4,
      "perceived": { "extraction": -0.2 },
      "descriptors": ["blackberry", "floral"],
      "measured": { "tds": 1.38 }
    }
  ]
}
```

That cup: liked it, tasted slightly under-extracted, measured 1.38 % TDS. With
262 g of beverage from 18 g of coffee that works out to about 20.1 %
extraction yield, a number the document does not state and any consumer can
compute.
