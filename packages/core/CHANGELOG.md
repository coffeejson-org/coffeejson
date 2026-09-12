# Changelog

Changes to `@coffeejson/core`. Changes to the format itself are in the
[root changelog](https://github.com/coffeejson-org/coffeejson/blob/main/CHANGELOG.md).

## [1.1.0] — 2026-09-11

### Added

- `decodeDocumentText` is exported from the package entry point. 1.0.0
  documented it but did not export it.
- `beanJsonLd(doc, beanIndex, options?)` exports a bean as a schema.org
  `Product` node. The node has no `offers`. It links the roaster's own listing
  through `sameAs`.
- `GEAR_LABELS` and `gearLabelsFor(lang?)` give the gear registry's labels,
  keyed by language tag.
- `GearRef` has the optional `variant` member of format 1.1.

### Changed

- `FORMAT_VERSION` is `"1.1"`.
- `gearLabel(g, labels?)` resolves a known id against the registry's own
  labels and renders `variant` beside that label, rather than reading the
  display string off the document. The bundled map is keyed by language tag.
  For `custom` and an unknown id, it shows the producer's `label` as written.
  Without a `label`, it shows `brand` and `model`, then `variant`. In 1.0.0 it
  showed the producer's `label` first for every id.
- `normalize` and `recipeJsonLd` read gear through `gearLabel`. As a result,
  `brewerLabel`, `grinderLabel`, `basketLabel` and the JSON-LD `tool` names
  follow the same rule.
- The schemas under `@coffeejson/core/schema` are the 1.1 schemas. They accept
  `variant` on the Gear object. The authoring schema admits `ext`, and it
  rejects `brand` and `model` on registered gear.
