# Versioning & conformance

## What you can rely on today

The format and its SDKs run on **different clocks**, and the rules in this
chapter govern only the first. A document's `coffeejson` version says nothing
about a package's API version.

| Surface | Status | What that means for you |
|---|---|---|
| The wire format (`coffeejson: "1.0"`) | **Early, one implementation** | The shape is settled and validated against a fixture corpus. Fields may still be added; the meaning of a defined field will not quietly change. |
| The JSON Schema at its `$id` | **Stable address** | `https://coffeejson.org/schema/1.0` keeps resolving, re-published in place as 1.x grows — see [The published schema](#the-published-schema). |
| `@coffeejson/core`, `@coffeejson/react`, `coffeejson-swift` | **1.0.0, semver** | Reference implementations that track the format while it can still change in place. A breaking API change is a major bump; a format change in place ships as a package release. The Swift package models the subset its consumers use rather than the whole format. |

While CoffeeJSON has one implementation the format may still change shape in
place. See [Evolving
1.0 in place](#evolving-10-in-place) for what that latitude covers and when
it ends. If you build during that window, pin a copy of the schema. The
[changelog](../../CHANGELOG.md) and the dated schema snapshots are the signal.

## Versioning

The `coffeejson` envelope field carries the [semantic version](https://semver.org)
of the specification a document conforms to.

- **Within a major version**, every change is **additive and optional**.
  New optional fields and new enum values can be introduced. Consumers ignore
  what they do not recognize (the [forward-compatibility
  contract](01-overview.md)). A document valid against `1.0` remains valid
  against `1.x`.
- **A breaking change bumps the major version.** Removing a field, changing a
  field's type, repurposing a value, or making an optional field required are
  all breaking and would produce `2.0`.
- The **minor** version increments when additive features are introduced.
  There is no patch component on the wire. Editorial fixes to this document
  that do not change the data model do not change the version a document
  declares.

**The required-unit trap.** A new [unit](06-vocabularies.md#units) is only
additive for **optional** measurements. A consumer treats an unrecognized
unit as absent ([Conformance](#conformant-consumer)). That is harmless on an
optional field like `water_temp`, but on a **required** measurement it
deletes the field. If a 1.1 added `kilogram` and a producer emitted it for
`coffee`, every 1.0 consumer would read that recipe as having *no dose at
all*, which is unusable despite "additive" versioning. So a minor can add
units usable on optional measurements. A unit intended for a required
measurement (`coffee`, `water`, `yield`) is a breaking change in effect and
waits for a major. The alternative, a producer that emits the 1.0 unit beside its
preferred one, is not modeled. Emit required measurements in the units 1.0
defines. `milliliter` on `water` is the one such unit 1.0 itself defines.

**The required-quantity trap.** [`basis`](06-vocabularies.md#basis)
generalizes the same hazard to structure. A new `basis` value changes *which*
required quantity a recipe states, so an older consumer reads such a recipe
as missing its brew quantity entirely. A new `basis` value is breaking in
effect and waits for a major. A consumer that meets an unknown one anyway
derives the effective basis from the quantities present
([Vocabularies § `basis`](06-vocabularies.md#basis)).

### Evolving 1.0 in place

CoffeeJSON 1.0 has a single known implementer and no second consumer to keep
compatible. While that holds, the format may evolve directly,
relocating or removing a field included, without a version bump or a
back-compatibility shim. The version stays `"1.0"`. The schema `$id` stays
`https://coffeejson.org/schema/1.0`. The [changelog](../../CHANGELOG.md)
records each change. This latitude ends at first outside adoption, after
which the rules above apply unconditionally.

**Documents minted by that implementer exist in the wild.** A change in place
costs a migration of whatever that producer serves, and the cost grows with
every document minted. It is still the right call while a better design is
available.

### The published schema

The [JSON Schema](../schema/coffeejson-1.0.schema.json) published at its
`$id` is a **producer gate for the current minor**. It validates what a
producer can emit *today*, which includes rejecting vocabulary values a newer
minor may later define. Each minor **re-publishes the schema at the same
`$id`** with the union of that major line's values, so the producer-visible
gap is bounded by release cadence. It is **never an inbound import gate**. A
consumer MUST NOT reject a document because it fails schema validation on
vocabulary values introduced by a newer minor. The [fallback
rules](06-vocabularies.md) govern import.

An **authoring variant**
([`coffeejson-1.0.authoring.schema.json`](../schema/coffeejson-1.0.authoring.schema.json))
is generated from this schema and published at its own `$id`
`https://coffeejson.org/schema/authoring/1.0`. It closes every object except
the reserved [`ext`](#reserved-extensions) member, which a
[localization](03-recipe.md#localizations) refuses too, requires optional
arrays to be non-empty, and requires
[`bean_ref`](03-recipe.md#bean_ref) on every recipe once a document carries
more than one bean. It catches three producer mistakes: a typo'd field name,
which the open runtime schema accepts silently; an empty emission that a
producer omits instead; and a recipe left unlinked when a second coffee joined
the document and [co-location](02-envelope.md#association-co-location) stopped
associating anything. Each of those is a document the runtime schema accepts,
and an unreferenced recipe is a state the envelope defines. It is a strict
producer lint, never a conformance or import gate.

### Reserved extensions

Some growth areas are **named but not defined** in v1.0. Naming them means
each can be added within the 1.x line without a breaking change. A producer
**MUST NOT** emit reserved fields as if they were defined in v1.0. A consumer
that meets an unknown member ignores it, per the
[forward-compatibility contract](01-overview.md#the-forward-compatibility-contract-summary).

1. **A professional cup-scoring module.** The consumer half of this is in
   v1.0. The [Tasting](05-tasting.md#fields) entity carries a drinker's
   rating, the perceived extraction/strength axes, flavor descriptors and a
   measured `tds`. That completes the small composable graph (*recipe ↔ bean
   ↔ tasting*). A tasting is distinct from
   [`bean.roaster_notes`](04-bean.md#roaster-notes). Notes are the roaster's
   attributed claim. A tasting is one drinker's evaluation of one cup.

   What stays reserved is the **professional** layer: a panel that scores
   coded samples on a named system. That system is the 2004 cupping form, the
   2024 Coffee Value Assessment, or a house scale. It is not a field the
   Tasting object is missing but a different artifact, with a different
   author, cardinality and audience. It also cannot be carried honestly as a bare
   number. The same attribute scores 6–10 in quarter points on one system and
   1–9 on another. A score without a declared system is a number a consumer
   can only misread. A scoring module names its system, its
   attributes and its scale, or it does not ship.
2. **Pressure / flow profiling.** The espresso model itself is whole in v1.0:
   method id, `basis`, `yield`, `pressure`, `preinfusion_s`, `basket`, and
   the `distribute` / `tamp` / `pull` step kinds
   ([Recipe § Espresso](03-recipe.md#espresso-dose--yield)). What stays
   reserved is the *dynamic* layer: a named, multi-phase, machine-executable
   pressure or flow profile (Decent-style shot files, a roaster's named
   preset). v1.0 carries the nominal numbers and free-text phase
   instructions. A structured profile object waits for real consumer pull.
3. **Descriptor normalization.** Aligning `roaster_notes` (and a future
   `tasting`) to the [Coffee Taster's Flavor Wheel](https://sca.coffee)
   lexicon — the Specialty Coffee Association and World Coffee Research
   artifact, which names both bodies on its face — so
   sensory descriptors become comparable across producers instead of free
   strings.
4. **A water profile.** A structured brew-water specification: TDS/hardness
   targets or a named mineral profile ("60 ppm", Third Wave Water). It is the
   one brew variable recipes state that v1.0 does not model. Water travels
   only as mass and temperature. Waits for a producer/consumer that exchanges
   it.
5. **A vendor-extension member `ext`.** The named home for *third-party*
   data, distinct from every other entry here, which reserves a future
   *first-party* shape. An application with private data that belongs in the
   document **SHOULD NOT** invent bare members on entities this specification
   defines. It **SHOULD** carry the data under `ext`, keyed by a vendor
   identifier (`"ext": { "app.example": { … } }`), or propose the field for
   the format itself. `ext` contents are vendor-defined by construction, so it
   is the one reserved name whose *use* is permitted today. Emitting it does not pretend a v1.0
   definition exists. The payoff is a clean growth path. A vendor field that
   proves out can be promoted to a defined optional field in a later minor,
   while the original `ext` data stays valid vendor data. Nothing renames.
   The full mechanism (identifier grammar, promotion process) is defined when
   a real adopter needs it. Until then the reservation is the convention.

### The version gate

A consumer decides support by the **major** component of `coffeejson`:

| Document major | Consumer behavior |
| --- | --- |
| Older or equal, supported | Process normally; ignore unknown fields. |
| Same major, newer minor | Accept; rely on forward-compatibility. |
| Newer major | **MAY reject.** SHOULD show a clear "unsupported version — please update" message rather than failing opaquely. |

A consumer **MUST NOT** silently misinterpret a newer major version as if it
were its own.

## Media type

The reserved media type for a CoffeeJSON document is:

```
application/vnd.coffeejson+json
```

The `+json` structured-syntax suffix signals that the payload is JSON and can
be processed by generic JSON tooling. Registration of this media type is
reserved for when the format is published. Until then it is the recommended
type for `Content-Type` headers and file associations.

## File extension

CoffeeJSON reserves **no dedicated file extension**. A CoffeeJSON file is a
plain `.json` file that contains exactly one CoffeeJSON
[document](02-envelope.md), in any envelope shape: a `recipes` array, a
`beans` array, or both. Type association happens through the
[media type](#media-type), not the extension. See
[Transport](../transport.md) for file, URL, and QR bindings.

## Conformance

### Conformant document

A document is **conformant** to CoffeeJSON 1.0 if:

1. It is a JSON object with a `coffeejson` string whose major version is `1`.
2. It contains **at least one** of `beans` or `recipes`, present and non-empty
   (the [envelope rule](02-envelope.md)).
3. Every Recipe in `recipes` has the required `title` and `coffee`, plus its
   `basis`'s stated brew quantity. That is `water` **or** `ratio` for
   `basis: "water"` (or absent, the default) — each fixes the other against the
   dose. For `basis: "yield"` it is `yield` instead, with neither `water` nor
   `ratio` ([Recipe § Espresso](03-recipe.md#espresso-dose--yield)). Each typed field
   that is present matches the type given in [Recipe](03-recipe.md) /
   [Bean](04-bean.md).

Unknown members at any level do **not** make a document non-conformant. The
forward-compatibility contract explicitly permits them.

The smallest conformant document is the
[minimal valid document](02-envelope.md#minimal-valid-document).

### Conformant producer

A producer is conformant if every document it emits is conformant and it
obeys five rules. It emits required fields. It emits URL-valued fields in
**URI form** (punycode hostname, percent-encoded path, the form a browser's
address bar copies out). It emits the linking members — `id`, `bean_ref`,
`recipe_ref` — in Unicode **NFC** normalization, which is load-bearing for the
byte-exact `bean_ref` ↔ `id` match, and SHOULD emit human-text strings in NFC
too ([Envelope §
Association](02-envelope.md#association-explicit-reference)). It serializes
[derived step labels as absent](03-recipe.md). It does not emit reserved
fields ([Reserved extensions](#reserved-extensions)) as if they were defined
in v1.0.

### Conformant consumer

A consumer is conformant if it:

- accepts every conformant document of a supported major version;
- **ignores unknown** members and maps unknown enum values per each
  [vocabulary's rule](06-vocabularies.md), and never rejects a document
  because it fails schema validation on values from a newer minor
  ([The published schema](#the-published-schema));
- **converts** any recognized [unit](06-vocabularies.md#units) to its own
  canonical store and treats an unrecognized unit as absent;
- **preserves step array order** and shows, rather than fails on, step kinds
  it does not model;
- never depends on the informational `generator` field.

A consumer **MAY** also validate against the
[JSON Schema](../schema/coffeejson-1.0.schema.json), but the prose
specification is authoritative where the two differ.

Two RECOMMENDED behaviors complete the picture. When a consumer re-emits a
document it did not author, it **SHOULD** preserve the members it did not
recognize. See [Overview § Preservation on
re-share](01-overview.md#preservation-on-re-share) for the round-trip /
re-author distinction. A consumer that scans QR codes or accepts links
**SHOULD** attempt payload extraction on any host's URL, not only its own. See
[Transport § Accepting links from any
host](../transport.md#accepting-links-from-any-host), which the fixture
corpus backs with executable scan vectors.

## Registry governance

The [open registries](06-vocabularies.md) (gear, varietal, addition type,
producer role) are curated data maintained beside this specification as plain
JSON (`registries/gear.json`, `registries/varietals.json`,
`registries/addition-types.json`, `registries/producer-roles.json`, each served
from the canonical host). Their governance is lightweight by design:

- **Adding an entry is a data change, not a spec change.** A new gear slug, a
  varietal alias or a recommended token does **not** bump the `coffeejson`
  version. Producers and
  consumers that have not yet synced the registry fall back per the
  vocabulary's rule, so nothing breaks.
- **Ids are stable.** Once published, a slug is not repurposed. Correcting a
  mistake means adding a new slug and aliasing the old one, never silently
  changing what a slug means.
- **Country codes are not curated here.** They track ISO 3166-1 directly.

If CoffeeJSON becomes a shared standard, extracting these registries into a
neutral, contribution-friendly repository is the natural first governance
step.

## Reporting a problem

Ambiguity in this specification is a bug. If two reasonable implementers
could read a sentence differently, that is worth an issue. The [fixture
corpus](../../fixtures/README.md) exists so a disagreement can be settled by
a test rather than by an argument.
