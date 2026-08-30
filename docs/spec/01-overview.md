# CoffeeJSON v1.0 — Overview

CoffeeJSON is a JSON document format for a coffee **brew** and the **coffee**
it was made from. A document travels between applications, languages, and
locales without loss.

This is version **1.0** of the specification, early and still open to change
in place ([Versioning § What you can rely on today](07-versioning.md#what-you-can-rely-on-today)).
The format is small on purpose. Reserved areas for future growth are named in
[Versioning § Reserved extensions](07-versioning.md#reserved-extensions).

## Why CoffeeJSON exists

CoffeeJSON rests on a simple belief: **coffee gets better for everyone when
brewing knowledge can travel.** A good recipe — a roaster's, a champion's, a
friend's — stops being useful the moment it is trapped in a screenshot, a blog
post, or one app's private database. When the same recipe moves cleanly
between apps, languages, and even the bag of beans it was written for, more
people brew well and more people enjoy what they drink; drinkers, roasters,
cafés, app makers, and gear makers build on each other's work instead of
re-typing it. The format is the small, shared, boring thing that makes this
possible — and growing it is meant as a contribution *to* the coffee industry,
not a land grab *inside* it.

## Scope

CoffeeJSON defines two co-equal top-level entities, plus a third that
evaluates them. Each is carried as an array collection:

- **`recipes`** — the parameters of a brew: dose, water or beverage yield (by
  `basis`), ratio, temperature, grind, and an ordered sequence of steps. Each
  element is defined in [Recipe](03-recipe.md).
- **`beans`** — the identity of the coffee: origin, process, varietal, altitude,
  roast, and the roaster's tasting notes. Each element is defined in
  [Bean](04-bean.md).
- **`tastings`** — how a brewed cup turned out: the drinker's attributed
  impression and, kept separately, what an instrument read. Each element is
  defined in [Tasting](05-tasting.md).

A document carries a `beans` array, a `recipes` array, or both. At least one of
the two is present and non-empty. `tastings` does not satisfy that rule,
because a tasting evaluates something the document must also carry. There is
no singular key. A single coffee or recipe is an array of one. The
[envelope](02-envelope.md) wraps the collections with a version marker.

When a `beans` array holds one coffee beside one or more recipes, those recipes
are *for* that coffee by co-location. This is the bag-to-brew case, and it
needs no identifier. A multi-coffee catalog pairs each recipe with its coffee
explicitly: the bean carries an `id` and the recipe a `bean_ref`
(see [Envelope § Association](02-envelope.md#association-explicit-reference)).

CoffeeJSON does **not** define a transport. A document is JSON, and you can
save it to a file, embed it in a URL, or encode it in a QR code. Recommended
bindings are described in the supporting document
[Transport](../transport.md). They are not part of the core data model.

## What CoffeeJSON is not

- **Not an inventory or journal format.** It carries a coffee's *identity*, a
  brew's *parameters* and a cup's *outcome*. It never carries personal or
  stateful data: no bag weight remaining, no "currently brewing" flag, no bag
  photo (see principle 4). A [Tasting](05-tasting.md) rates one brew on one
  occasion and carries no timestamp and no drinker. A coffee itself is never
  rated.
- **Not a sensory-evaluation format.** A roaster's tasting notes are carried
  as *attributed claims* and a drinker's as *attributed opinion*. A structured
  cupping score is a reserved extension, not part of v1.0 (see
  [Versioning § Reserved extensions](07-versioning.md#reserved-extensions)).
- **Not a grinder-conversion engine.** Grind settings are captured as the
  sender expressed them. The format never converts one grinder's scale to
  another's (see [Recipe § Grind](03-recipe.md)).

## Design principles

Two kinds of principle run through CoffeeJSON: how the **data** is modeled,
and how the **format** is adopted and grown. The first four drive nearly every
field-level decision. The last five drive what gets added, what gets refused,
and how easy the format is to adopt.

### How the data is modeled

1. **Fact, claim, and opinion are distinct.** Every piece of information is
   one of three tiers, and each tier is encoded differently:

   | Tier | What it is | Where it lives | Encoding |
   | --- | --- | --- | --- |
   | **Measured fact** | reproducible with a scale, a thermometer, and a timer | Recipe quantities, times, per-step `to_water`; a Tasting's `measured` | values with canonical [units](06-vocabularies.md#units) |
   | **Declared claim** | what the roaster states | Bean identity fields; the recipe's `recommended` | normalized to queryable forms (ISO country, meters, Agtron, ISO date) — claimed, never verified |
   | **Attributed opinion** | a sensory impression, a rating | `roaster_notes` and `description`; a Tasting's `rating`, `perceived`, `descriptors` | always attributed to its source; never asserted as bare fact |

   A descriptor is never promoted to a claim, and a consumer **MUST NOT** merge
   one source's descriptors with another's. A rating attaches to a cup
   ([Tasting](05-tasting.md)), never to a coffee. A Tasting carries fact
   (`measured`) beside opinion (`perceived`) in separate members, so neither is
   rendered as the other. A field that is none of the three is personal state
   and does not belong in the format (principle 4).

2. **Locale-neutral on the wire, localized at the edges.** Everything
   enumerable travels as a stable, language-independent machine id: methods,
   processes, roast levels, countries, gear, varietals. Each consuming
   application renders its own localized display string from that id. Human
   free text, such as a title or a custom step note, travels as written with an
   optional `lang` hint.

3. **Canonical unit identifiers.** Measurement units travel as semantic,
   locale-neutral identifiers such as `gram`, `ounce`, `celsius`,
   `fahrenheit`, `meter`, and `foot`. They never travel as display symbols such
   as `g`, `oz`, `°C`, or `°F`. Producers MUST emit these canonical
   identifiers, and consumers MUST localize display at the edges.

4. **Identity, not inventory.** The format carries a coffee's identity
   (origin / process / roast) and a brew's parameters. Three kinds of thing
   stay out, and roasters publish all three:
   - **Personal and inventory state** — a bag's weight, a purchase date, a
     drinker's own rating. If a field only makes sense for *one owner at one
     moment*, it does not belong here.
   - **Commercial state** — price, green cost, lot size, stock status, cups per
     bag, a supplier-pay grade. These are facts about a transaction, not about
     the coffee, and they go stale the moment the bag is sold.
   - **Third-party judgments** — a cup score, a competition placement, a
     traceability grade. They are someone's evaluation rather than the
     coffee's identity. A scored cup evaluation is a separate entity, reserved
     by name in
     [Versioning § Reserved extensions](07-versioning.md#reserved-extensions).

   The test that decides all three: **would this still be true, and still
   about this coffee, a year from now in someone else's hands?**

### How the format is adopted and grown

5. **Portable and drop-in.** A document is *just JSON*: no backend, no
   account, nothing that has to phone home. It saves to a file, rides inside a
   share URL, or prints as a QR code. A typical recipe is a few hundred bytes,
   small enough to travel inside the link itself, compressed or not
   ([transport](../transport.md)). CoffeeJSON defines *no* transport of its
   own, so it drops into whatever channel an application already has.

6. **Incremental to adopt.** Implement a little or a lot. The smallest valid
   document is a title and two measurements. Everything richer is optional:
   method, grind, steps, a `beans` collection beside the recipes. A useful
   integration is an afternoon's work, and it can deepen later without a
   rewrite of what came first.

7. **Extensible, never breaking.** The format grows *additively*. New optional
   fields and reserved areas
   ([Versioning § Reserved extensions](07-versioning.md#reserved-extensions))
   arrive within a major version. Consumers **MUST ignore what they do not recognize** rather than
   fail, so a document that is valid today stays valid as the format grows. The
   precise consumer obligation is the
   [forward-compatibility contract](#the-forward-compatibility-contract-summary).
   (While there is one implementation the format may still evolve in place —
   [Versioning § Evolving 1.0 in place](07-versioning.md#evolving-10-in-place).
   From first outside adoption this principle binds unconditionally.)

8. **No lock-in.** CoffeeJSON is [CC0](https://creativecommons.org/publicdomain/zero/1.0/)
   public domain: the spec, the schema, the fixtures, the registries, and the
   corpus's structure and transcription. Quoted roaster prose in corpus
   documents remains the quoted source's, attributed. The registries are open,
   and the ids are vendor-neutral, so nothing in a document encodes one
   implementation's private scheme. What one implementation writes, any other
   can read. What a user shared, they can always get back. The format traps no
   one.

9. **Minimal — resist overengineering and overgeneralization.** Model what is
   real, common, and verifiable. *Reserve the rest by name* (principle 7)
   instead of half-building it. Refuse abstractions that would emit
   confidently-wrong data. The format captures a grind setting as stated. It
   will not pretend to convert one grinder's scale to another's. A small
   format that ships and interoperates beats a general one that does neither.
   When in doubt, leave it out. An optional field can always be added later,
   but it can never be cleanly removed.

## Conformance language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this
specification are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). They carry their special
meaning only when in **ALL CAPITALS**.

Two roles are referenced throughout:

- A **producer** is software that emits CoffeeJSON documents.
- A **consumer** is software that reads them.

A single application is usually both. Requirements are stated against the role
they constrain. Where a requirement is unqualified, it applies to both.

### The forward-compatibility contract (summary)

The rule from principle 7 (*extensible, never breaking*) governs how every
consumer behaves, so it is restated here as a contract:

- A consumer **MUST** ignore any object member it does not recognize, at any
  depth, and **MUST** continue processing the members it does recognize. An
  *element* of a collection that is not an object is not an unknown member
  ([Envelope § Fields](02-envelope.md#fields)).
- A consumer **MUST NOT** reject a document solely because it contains unknown
  members or unknown enumerated values. Unknown enumerated values are handled
  per each vocabulary's rule, usually by mapping to a defined `other` or
  fallback value (see [Vocabularies](06-vocabularies.md)).
- A consumer **MAY** reject a document whose **major** `coffeejson` version it
  does not support (see [Versioning](07-versioning.md)).

### Preservation on re-share

The contract above governs *reading*. On the way back out, when an application
emits a document that carries data it did not author, two cases differ. The
rule is to be honest about which one is happening:

- **Round-trip:** the consumer re-emits a document it imported, with the
  carried data unedited (import → share on). The consumer **SHOULD preserve**
  members it did not recognize rather than strip them, so a document does not
  silently shed data as it travels through less-capable consumers.
- **Re-authoring:** the producer rebuilds a document from its own model, such
  as an edit form or an internal library. The producer **MAY drop** what it
  does not model, and **SHOULD disclose** that the re-emitted document is its
  own reduction of the original (for example, "re-exported — some original
  data not carried").

