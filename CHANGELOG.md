# Changelog

Changes to the CoffeeJSON **format** — the schema, the spec prose, and the
fixture corpus. The SDKs version independently
([Versioning & conformance](docs/spec/07-versioning.md#what-you-can-rely-on-today)).
The `coffeejson` version string tracks the format, and 1.x grows additively in
place ([Versioning](docs/spec/07-versioning.md)); layout follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
