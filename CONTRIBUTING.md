# Contributing to CoffeeJSON

| You want to… | Do this |
| --- | --- |
| Report an ambiguity or error in the spec | Open a **spec ambiguity** issue. If two reasonable implementers could read a sentence differently, that is a bug ([Versioning § Reporting a problem](docs/spec/07-versioning.md#reporting-a-problem)). |
| Propose a new field or vocabulary value | Open a **field proposal** issue; the template asks for what the decision needs and states the bar. See [Proposing a field](#proposing-a-field). |
| Add a gear slug or varietal alias | A pull request against [`registries/gear.json`](registries/gear.json) / [`registries/varietals.json`](registries/varietals.json). A registry addition is a data change, not a spec change — no version bump. See [Registry entries](#registry-entries). |
| List your implementation | A one-line pull request to [`registries/implementations.json`](registries/implementations.json) ([Integration guide § List your implementation](docs/integration-guide.md#list-your-implementation)). |
| Fix fixtures, tooling, examples, or the site | A pull request; see [Running the checks](#running-the-checks). |

## Ground rules

1. **The prose specification is authoritative.** The JSON Schema tracks it; if
   they disagree, the prose wins and the schema is the bug. The harness enforces
   their field-level and vocabulary-level agreement.
2. **Schema changes are fixture-first.** A schema change lands with a fixture
   that exercises it and the matching prose. `pnpm test` is green on every
   commit.
3. **Additive within a major.** New fields are optional; enum growth follows
   each vocabulary's stated rule; nothing defined is removed, repurposed, or
   made required inside 1.x ([Versioning](docs/spec/07-versioning.md#versioning)).
   While there is one implementation it may still evolve in place ([Versioning §
   Evolving 1.0 in place](docs/spec/07-versioning.md#evolving-10-in-place)).
4. **When in doubt, leave it out.** An optional field can always be added
   later; it can never be cleanly removed.

## Proposing a field

**Prove it by consuming it.** Implement the field under the vendor-extension
member [`ext`](docs/spec/07-versioning.md#reserved-extensions) in a real
application first — valid today, and it turns a design argument into a field
report. The [field-proposal template](.github/ISSUE_TEMPLATE/field-proposal.yml)
states the bar a field clears to enter the core schema. Accepted fields ship in
the next **minor**; larger entities stage through
[Reserved extensions](docs/spec/07-versioning.md#reserved-extensions) first.

## Registry entries

Published ids are stable: correct a mistake by adding a new slug and aliasing
the old one, never by repurposing what a slug means
([Versioning § Registry governance](docs/spec/07-versioning.md#registry-governance)).
A gear entry carries a kebab-case `id`, a category, a neutral label, and
brand/model where unambiguous; a varietal entry carries the canonical name and
the aliases and breeding codes it absorbs.

## Running the checks

```
pnpm install
pnpm test        # schema, fixtures, corpus, doc examples, parity, doc links, registries, scan vectors
pnpm test:all    # the harness plus every workspace suite
```

`pnpm validate:doc path/to/document.json` checks one document. CI runs the same
commands on every pull request.

## Licensing

Contributions follow the repository's licensing by kind
([README § License](README.md#license)): format artifacts under CC0, code
under Apache-2.0 (inbound = outbound, §5). No CLA.
