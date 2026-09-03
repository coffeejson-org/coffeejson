# CoffeeJSON

The open interchange format for coffee recipes and bean identity.
Canonical home: **coffeejson.org**

Read `CONTRIBUTING.md` first — the ground rules, the bar a new field clears, the
registry rules, and the checks. This file adds only what that one does not say.

## Layout

- `docs/spec/` — the prose specification. **Authoritative.** Where the schema
  disagrees with it, the schema is the bug.
- `docs/schema/` — two variants of the JSON Schema. The runtime schema is
  deliberately permissive and ignores members it does not recognize; the
  authoring schema closes every object, so a typo fails loudly instead of
  vanishing. Generators validate against **authoring**.
- `fixtures/` — the conformance corpus, valid and invalid. `recipes/` — real
  recipes transcribed from published sources, each naming its own.
- `registries/` — curated data (gear, varietals, implementations, …), not spec.
  An entry bumps no version.
- `packages/core`, `packages/react` — the reference SDKs.
- `apps/site` — coffeejson.org, a Vite multi-page site on GitHub Pages.

## Toolchain

Node 26 and pnpm, both pinned (`.node-version`, `mise.toml`). Biome formats and
lints, and CI fails on a diff.

    pnpm install
    pnpm check     # format and lint, writing fixes
    pnpm test      # schema, fixtures, corpus, doc examples, parity, doc links,
                   # registries, scan vectors
    pnpm test:all  # the above plus every workspace suite

## Generated files — derived, not written

**The authoring schema is derived from the runtime one.** Edit
`docs/schema/coffeejson-1.0.schema.json`, then run
`node tools/gen-authoring-schema.mjs`. Both are committed, and `pnpm test` fails
on drift between them.

`pnpm --filter coffeejson-site gen` writes, and `.gitignore` excludes,
`apps/site/public/{sitemap.xml,llms.txt,llms-full.txt,agents.md,docs/,registries/,schema/,demo/}`,
`apps/site/{recipes,beans}/*/`, and `packages/core/schema/`. Editing one of those
is work the next build discards.

**A new document under `docs/` is unserved until it is registered** in
`apps/site/tools/gen.mjs` (`SPEC_DOCS` / `GUIDE_DOCS`). Pages publishes
`apps/site/dist`, so the repository's `docs/` is not reachable at the canonical
host without that copy.

## Adding a site page

Four places, or it does not build: the shell at `apps/site/<name>/index.html`,
the body at `apps/site/src/pages/<name>.ts`, an entry in `tools/prerender.ts`,
and an input in `vite.config.ts`. Add the path to `INDEXABLE_PATHS` in
`tools/gen.mjs` as well — that one array feeds both the sitemap and the check
that robots.txt never blocks a URL the sitemap advertises.

Three more lists are hardcoded, and a page missing from them ships with **no
test failing** — the silent gap, so add the page to all three: `PAGES` in
`tests/seo-furniture.test.ts` (canonical, Open Graph, title and description),
`entryPages()` in `tests/analytics.test.ts` (the footer's privacy sentence), and
`documents` in `tests/served-links.test.ts` if the page also emits markdown.

A module `tools/gen.mjs` imports is `.mjs` with a `.d.mts` beside it, because it
runs in plain Node rather than through vite.
