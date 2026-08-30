# Document envelope

A CoffeeJSON document is a JSON object with a single version marker plus three
OPTIONAL array collections: `beans`, `recipes` and `tastings`. **At least one**
of `beans` or `recipes` must be present and non-empty.

```json
{ "coffeejson": "1.0", "recipes": [ /* one or more Recipe */ ] }
```

```json
{ "coffeejson": "1.0", "beans": [ /* one or more Bean */ ] }
```

## Fields

| Field | Type | Req? | Notes |
| --- | --- | --- | --- |
| `coffeejson` | string | yes | The **schema version** of the format itself (semver). See below. |
| `beans` | array of Bean | cond.¹ | Zero or more [Bean](04-bean.md) objects. One element shares a single coffee; several form a catalog / lineup. Omit when empty. |
| `recipes` | array of Recipe | cond.¹ | Zero or more [Recipe](03-recipe.md) objects. One element is a share; several are a library export. Omit when empty. |
| `tastings` | array of Tasting | no | Zero or more [Tasting](05-tasting.md#fields) objects — how a brewed cup actually turned out. Each rides with the recipe it evaluates. Omit when empty. |
| `generator` | object | no | The software that wrote this document: `{ "name": string, "version": string, "url": string (URI) }`, `name` required. Informational; consumers **MUST NOT** depend on it. See below. |

¹ A document **MUST** contain **at least one** of `beans` or `recipes`, present
and **non-empty**. A document with neither, or with only empty arrays, is
invalid, and a consumer **SHOULD** reject it. There is no singular `bean` or
`recipe` key. A single coffee or recipe is an array of one element.

`tastings` does **not** satisfy that rule. A tasting evaluates something, so a
document that carries only tastings describes nothing a consumer can act on.
It is invalid for the same reason an empty document is.

Every element of `beans`, `recipes` and `tastings` **MUST** be a JSON object. A
collection holding anything else — `null`, a number, a string, a nested array —
is malformed. Such an element is **not** an unknown member the
[forward-compatibility contract](01-overview.md#the-forward-compatibility-contract-summary)
tells a consumer to ignore; it is a slot that claims to hold an entity and does
not. What a consumer does next depends on its role. One that imports into a
store **SHOULD** reject the document and name the collection. One that only
renders **MAY** skip the element and render the rest. Both are conformant; a
consumer picks by what it is, not by reading this rule twice.

### Why always-array, not singular + plural

CoffeeJSON exposes each collection as **only** an array. There is no singular
key beside a plural one, and no field that is sometimes an object and sometimes
an array. A shape that varies by cardinality forces every consumer to branch
(*is it one or many?*) before it can use the data, the known rough edge of
HAL's `_embedded`. With one fixed shape, a strongly-typed consumer decodes the
document as a plain three-collection structure (`beans: [Bean]`,
`recipes: [Recipe]`, `tastings: [Tasting]`) with no discriminator and no
polymorphism. "The single one" is the first element. This also follows
[BeerJSON](https://github.com/beerjson/beerjson), whose collections are only
arrays and whose only scalar is the version marker.

### `coffeejson`

`coffeejson` names the version of the *specification* a document conforms to.
This follows the convention, shared with OpenAPI and BeerJSON, where the root
marker names the spec and its version. It is **not** a per-recipe revision
number, and it is not a property of any individual recipe.

The value is a [semantic version](07-versioning.md). For v1.0 the value is the
string `"1.0"`. A consumer determines support by the **major** component:

- A consumer **MAY** reject a document whose major version it does not
  implement. It **SHOULD** show a clear "unsupported version" message rather
  than fail opaquely.
- A consumer **SHOULD** accept a document with the same major version and a
  newer minor version. The [forward-compatibility contract](01-overview.md)
  tells it to ignore what it does not recognize.

### `generator`

`generator` records what **software** emitted this JSON: its name, its
version, and optionally its own URL. `name` is required, because a generator
that does not name the software states nothing. `version` and `url` are
optional. `url` must be a well-formed URI.

The emitter need not be an application. A hosted service, a build script, a
command-line tool, or a language model can write a CoffeeJSON document. Each of
them names itself in the same member.

```json
{
  "coffeejson": "1.0",
  "generator": { "name": "ExampleBrewApp", "version": "2.3.0", "url": "https://example.com/brewapp" },
  "recipes": [
    { "title": "Weekday V60", "coffee": { "value": 15, "unit": "gram" }, "water": { "value": 250, "unit": "gram" } }
  ]
}
```

It is **informational only**. A consumer **MUST NOT** change how it imports a
document based on `generator`. It **MAY** show it, for example as an "Imported
from …" marker. Nothing in the format depends on it. A document that omits it
is in no way lesser, and most are written by hand.

**Why it sits on the envelope.** A file is written once, by one program. Which
software serialized it is a fact about the *document*, not about any recipe or
coffee inside it. A three-recipe export would otherwise repeat an identical
value three times. A document that carries only `beans` would have nowhere to
put it. This follows Atom's `<generator>`, which identifies the agent that
produced a feed and sits on the feed rather than the entry. It also follows
schema.org, which attaches document provenance to the top-level `CreativeWork`.

**Distinct from the two attribution fields.** Both stay on the Recipe because
they vary between recipes in one document.
[`based_on`](03-recipe.md#attribution-author-based_on) is where a recipe was
*published*, and [`author`](03-recipe.md#attribution-author-based_on) is who
devised it. `generator` is neither. Software that exports someone else's
recipe is not its author and not its publisher. See [Recipe §
Attribution](03-recipe.md#attribution-author-based_on).

## Single vs. multiple recipes

The `recipes` array does two jobs. Only the number of elements tells them
apart:

- **One element** is the unit of *sharing*. A single recipe keeps a
  [share link](../transport.md) small and unambiguous.
- **Several elements** are the unit of *export*. A library or backup contains
  many recipes. One document wraps them all, so there is no version marker per
  recipe.

A consumer **MUST** parse the `recipes` array whatever its length. It
**SHOULD** report how many recipes it found rather than fail silently.

## Single vs. multiple beans

`beans` mirrors `recipes` exactly. It is the same array, told apart by length:

- **One element** is the unit of *sharing*: a single coffee, on its own or
  paired with a brew, that you want someone else to taste.
- **Several elements** are the unit of *cataloguing*: a roaster's current
  lineup, or an app's library of distinct coffees, all in one document.

A **blend is still one Bean**, one element of `beans`. It is expressed as an
[origin](04-bean.md#origin-object) of `type: "blend"` with several `items`. A
multi-element `beans` array means several **distinct coffees**, never the
components of one blend.

```json
{
  "coffeejson": "1.0",
  "beans": [
    { "name": "Nano Challa", "roaster": { "name": "Example Roastery" }, "process": ["washed"], "roast_level": "light_medium" }
  ]
}
```

A `beans` catalog is the same Bean object, several times over:

```json
{
  "coffeejson": "1.0",
  "beans": [
    { "name": "Nano Challa", "roaster": { "name": "Example Roastery" }, "process": ["washed"] },
    { "name": "Las Brisas",  "roaster": { "name": "Example Roastery" }, "process": ["natural"] }
  ]
}
```

## Association (co-location)

When `beans` holds **exactly one** element beside a non-empty `recipes` array,
every recipe without a [`bean_ref`](03-recipe.md#bean_ref) is **for that one
coffee**: the bag together with the way to brew it. This is the
**bag-to-brew** case. The association is by **co-location alone**. Because
there is a single bean, no identifier and no reference are needed
(`beans.length == 1` is the trigger). An explicit `bean_ref`, when present,
always takes precedence. See
[Association (explicit reference)](#association-explicit-reference).

```json
{
  "coffeejson": "1.0",
  "beans": [
    {
      "name": "Nano Challa",
      "roaster": { "name": "Example Roastery" },
      "process": ["washed"],
      "roast_level": "light_medium"
    }
  ],
  "recipes": [
    {
      "title": "Roaster's V60",
      "method": "pour_over",
      "coffee": { "value": 15,  "unit": "gram" },
      "water":  { "value": 250, "unit": "gram" }
    }
  ]
}
```

That single bean can carry **several** recommended recipes. They are all for
that one coffee:

```json
{
  "coffeejson": "1.0",
  "beans": [ { "name": "Nano Challa", "roaster": { "name": "Example Roastery" } } ],
  "recipes": [
    { "title": "V60",       "method": "pour_over", "coffee": { "value": 15, "unit": "gram" }, "water": { "value": 250, "unit": "gram" } },
    { "title": "AeroPress", "method": "aeropress",  "coffee": { "value": 14, "unit": "gram" }, "water": { "value": 220, "unit": "gram" } }
  ]
}
```

## Association (explicit reference)

Co-location resolves the association only when `beans` has **one** element. A
`beans` array of **two or more** elements together with `recipes` cannot be
read from position. Which recipe belongs to which coffee needs an explicit
reference: an [`id`](04-bean.md#id) on each referenced bean, and a
[`bean_ref`](03-recipe.md#bean_ref) on each recipe that belongs to a specific
coffee.

```json
{
  "coffeejson": "1.0",
  "beans": [
    { "id": "nano-challa", "name": "Nano Challa", "roaster": { "name": "Example Roastery" }, "process": ["washed"] },
    { "id": "las-brisas",  "name": "Las Brisas",  "roaster": { "name": "Example Roastery" }, "process": ["natural"] }
  ],
  "recipes": [
    { "title": "Nano Challa V60", "bean_ref": "nano-challa", "recommended": true,
      "method": "pour_over", "coffee": { "value": 15, "unit": "gram" }, "water": { "value": 250, "unit": "gram" } },
    { "title": "Las Brisas French Press", "bean_ref": "las-brisas",
      "method": "french_press", "coffee": { "value": 30, "unit": "gram" }, "water": { "value": 500, "unit": "gram" } }
  ]
}
```

For each recipe, association resolves by one rule: **an explicit reference
wins, and co-location covers the single-bean case**.

1. If the recipe carries `bean_ref`, it is associated with the bean whose `id`
   equals that value, an **exact, case-sensitive** string match. If no bean
   matches, the recipe is associated with **no** bean. An unresolved reference
   is never an error, and there is **no** fall-back to co-location, because an
   explicit reference wins even when broken. A validator **SHOULD** warn.
   Because the match is byte-exact, producers **MUST** emit `id` and
   `bean_ref` in Unicode **NFC** normalization form. The same visible string
   in two normalization forms (a name with a combining accent, say) would
   otherwise silently fail to link. Producers **SHOULD** emit all human-text
   strings in NFC.
2. Otherwise, if `beans` holds exactly one element, the recipe is associated
   with that bean by [co-location](#association-co-location).
3. Otherwise, the recipe is associated with no bean.

Every `id` present **MUST** be unique within `beans`
([Bean § `id`](04-bean.md#id)). If several beans share an id, the document is
malformed. A consumer **MUST NOT** fail and **SHOULD** treat references to that
id as unresolved.

A multi-element `beans` array whose recipes carry no `bean_ref` remains a
**valid** document, and a consumer **MUST NOT** treat it as an error. It
imports the beans and recipes as independent entities and draws no links
between them, per the [forward-compatibility contract](01-overview.md).

## Association (a tasting's recipe and coffee)

A [Tasting](05-tasting.md#fields) points at what it evaluates. It resolves its
**recipe** and its **coffee** independently.

The recipe is resolved by `recipe_ref` alone: the recipe whose
[`id`](03-recipe.md#id) equals that value, an **exact, case-sensitive** match,
with the same NFC requirement as every other reference in this format. An
unresolved `recipe_ref` leaves the tasting unlinked. A consumer **MUST NOT**
fail, and **SHOULD** warn. There is no positional fall-back. A tasting with no
`recipe_ref` names no recipe.

The coffee resolves by the same two-step rule the recipes use: **an explicit
reference wins, and co-location covers the single-bean case**.

1. If the tasting carries `bean_ref`, it is associated with the bean whose
   `id` equals that value, exactly and case-sensitively. This holds **even
   when the referenced recipe names a different bean**. See below.
2. Otherwise, if `beans` holds exactly one element, the tasting is associated
   with that bean by [co-location](#association-co-location).
3. Otherwise, the tasting is associated with no bean.

**A tasting's own `bean_ref` wins over its recipe's.** When the two disagree,
the document is not malformed, and a consumer **MUST NOT** report a conflict.
It is *"I brewed your recipe with my coffee"*, the ordinary case for a recipe
someone else published. A consumer renders the tasting against the bean the
*tasting* names, and leaves the recipe's own association untouched.

```json
{
  "coffeejson": "1.0",
  "beans": [
    { "id": "nano-challa", "name": "Nano Challa", "roaster": { "name": "Example Roastery" } },
    { "id": "las-brisas",  "name": "Las Brisas",  "roaster": { "name": "Example Roastery" } }
  ],
  "recipes": [
    { "id": "roasters-v60", "title": "Roaster's V60", "bean_ref": "nano-challa",
      "method": "pour_over", "coffee": { "value": 15, "unit": "gram" }, "water": { "value": 250, "unit": "gram" } }
  ],
  "tastings": [
    { "recipe_ref": "roasters-v60", "bean_ref": "las-brisas", "rating": 4 }
  ]
}
```

That cup followed the Nano Challa recipe but was brewed with Las Brisas. The
recipe is still *for* Nano Challa. The tasting is *about* Las Brisas.

Every `id` present **MUST** be unique within its own collection, and
`tastings` is no different from `beans` and `recipes`. Duplicates make the
document malformed. A consumer **MUST NOT** fail and **SHOULD** treat
references to that id as unresolved.

## Minimal valid document

The smallest conformant document is a `recipes` array of one recipe with a
title and the two required measurements:

```json
{
  "coffeejson": "1.0",
  "recipes": [
    {
      "title": "Everyday V60",
      "coffee": { "value": 15,  "unit": "gram" },
      "water":  { "value": 250, "unit": "gram" }
    }
  ]
}
```

Everything else in a Recipe is optional. See [Recipe](03-recipe.md) for the
full field set and [`fixtures/valid/`](../../fixtures/README.md#valid) for
richer documents.
