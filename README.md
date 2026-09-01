<!-- Two files rather than the SVG: GitHub strips the media query an adaptive
     SVG would need, so the dark variant is served by <picture> instead. -->
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/site/public/mark-on-dark.png">
  <img src="apps/site/public/mark.png" alt="" width="76" height="76">
</picture>

# CoffeeJSON

**Coffee recipes as data, not screenshots.**

CoffeeJSON is an open JSON format for a brew and the coffee it was made from.
Write a recipe in one app and open it in another — as a file, a share link, or
a QR code — and it arrives intact: dose, water, temperature, grind, and the
pour schedule, in the reader's own units and language. Small enough to ride
inside a QR code. Public domain.

- **Status:** 1.0, early — settled in shape, and still open to change while there is one implementation ([what you can rely on today](docs/spec/07-versioning.md#what-you-can-rely-on-today)). Second implementations and field reports wanted.
- **Spec:** [`docs/`](docs/README.md) · **Schema:** [`docs/schema/coffeejson-1.0.schema.json`](docs/schema/coffeejson-1.0.schema.json) · **Site:** [coffeejson.org](https://coffeejson.org)

The smallest valid document — a title and the two required measurements:

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

A document carries two entities, kept distinct: **`recipes`** (dose, water,
ratio, temperature, grind, timed steps) and **`beans`** (origin, process,
varietal, altitude, roast, roaster notes). Every field keeps measured **fact**,
declared **claim**, and attributed **opinion** apart
([Overview § Design principles](docs/spec/01-overview.md#design-principles)).

## In this repository

- [`docs/`](docs/README.md) — the specification, the transport binding, and the guides.
- [`fixtures/`](fixtures/README.md) — the conformance corpus: valid documents, and invalid ones that each break a single rule.
- [`recipes/`](recipes/README.md) — the recipe corpus: documents transcribed from roasters' own pages and guides.
- [`registries/`](registries/) — gear, varietals, addition types, producer roles, and the self-declared implementations registry.
- [`packages/core`](packages/core/README.md) · [`packages/react`](packages/react/README.md) — the TypeScript SDKs (`@coffeejson/core`, `@coffeejson/react`). Apple platforms: `coffeejson-swift`.

`pnpm test` validates every fixture, every corpus document, and every complete
JSON example in the docs against the schema.

Agent skills — one for changing the format, one for adding it to a product, one
for turning a published source into a document — live in
[`coffeejson-org/skills`](https://github.com/coffeejson-org/skills).

## Contributing

Field proposals, registry entries, spec-ambiguity reports, and the checks that
gate every change: [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The **format** — spec prose, JSON Schema, fixtures, registries, and the corpus's
structure and transcription — is
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
(public domain). Roaster prose quoted in a corpus document (`description`,
`roaster_notes`) remains the source's, carried as attributed quotation and
removed on request ([recipes/README](recipes/README.md#licensing)).

The **code** — `packages/*`, `apps/site`, `tools/` — is
[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0). See [LICENSE](LICENSE).
