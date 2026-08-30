# CoffeeJSON documentation

The normative specification, the transport binding, and the guides that apply
them. Where a guide, an example, or the JSON Schema disagrees with the
specification prose, the prose wins.

## Specification

Read in order; each chapter is self-contained enough to cite on its own.

1. [**Overview**](spec/01-overview.md) — scope, the three entities, design
   principles, and the conformance language (MUST / SHOULD / MAY).
2. [**Document envelope**](spec/02-envelope.md) — the `coffeejson` version
   marker plus the `beans`, `recipes`, and `tastings` collections.
3. [**Recipe**](spec/03-recipe.md) — the brew-parameters entity: Measurement,
   Gear, Grind, and Step.
4. [**Bean**](spec/04-bean.md) — the coffee-identity entity: Origin,
   OriginItem, process, varietals, and roast attributes.
5. [**Tasting**](spec/05-tasting.md) — how a brewed cup turned out: attributed
   impression and instrument reading, kept apart.
6. [**Vocabularies & registries**](spec/06-vocabularies.md) — every controlled
   vocabulary, the two open registries (gear, varietals), and the fallback
   rules.
7. [**Versioning & conformance**](spec/07-versioning.md) — versioning, media
   type, conformance targets, registry governance.

## Transport binding

- [**Transport**](transport.md) — a document as a file, inside a share URL,
  or in a QR code. Normative for the binding only: the data model defines no
  transport, and an implementation may ignore this entirely. Its share-URL
  rules are executable as
  [`fixtures/transport/scan-vectors.json`](../fixtures/README.md#transport).

## Guides (non-normative)

- [**Integration guide**](integration-guide.md) — the consumer and producer
  checklists, in build order.

## Schema

- [`schema/coffeejson-1.0.schema.json`](schema/coffeejson-1.0.schema.json) —
  JSON Schema (Draft 2020-12). It permits unknown properties, because
  consumers MUST ignore unknown fields
  ([Overview § Forward compatibility](spec/01-overview.md#the-forward-compatibility-contract-summary)).
- [`schema/coffeejson-1.0.authoring.schema.json`](schema/coffeejson-1.0.authoring.schema.json) —
  the strict, generated producer-lint variant
  ([Integration guide § Lint your output](integration-guide.md#producing--the-export-checklist)).
  Never an import gate.
- [`../fixtures/`](../fixtures/README.md) — the conformance corpus. `pnpm test`
  validates it, and every complete JSON example in these docs, against the
  schema.
