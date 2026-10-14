# @coffeejson/core

Framework-free TypeScript SDK for [CoffeeJSON](https://coffeejson.org) documents.

## A share link, end to end

```ts
import {
  decodeScanned, fmtClock, fmtMeasurement, formatRatio, normalize,
} from "@coffeejson/core";

const result = decodeScanned(scannedText);
if (!result.ok) throw new Error(result.error.kind); // one of DECODE_ERROR_KINDS

const recipe = normalize(result.document).recipes[0]!;

console.log(recipe.title);                                  // Everyday V60
console.log(
  `${recipe.method} · ${fmtMeasurement(recipe.coffee)} → ` +
  `${fmtMeasurement(recipe.water)} · ${formatRatio(recipe.ratio)}`,
);                                            // pour_over · 15 g → 250 g · 1 : 16.7
for (const s of recipe.steps)
  console.log(`${fmtClock(s.atS!)} ${s.text} → ${fmtMeasurement(s.toWater)}`);
                                              // 0:00 Bloom → 50 g …
```

`tests/example.test.ts` runs exactly this, so it cannot rot.

## Install

```sh
npm install @coffeejson/core
```

This package's version is its own. It says nothing about the `coffeejson`
version a document declares
([Versioning](https://coffeejson.org/docs/spec/07-versioning.md)).

From a checkout of this repository, `pnpm install && pnpm -r build` produces
`dist/`; depend on the package by path from there.

- **Types** — wire interfaces for the 1.1 format (`CoffeeJSONDocument`, `Recipe`, `Bean`, …).
- **Codec** — `decodeScanned(text)` takes a scanned string in and returns a
  document or a stated reason. It parses the URL, requires `http(s)`, reads
  `?d=` and decodes, so the transport spec's steps are not yours to reassemble.
  The published scan-vector corpus pins its behavior — a **scan vector** is one
  URL exactly as a scanner or link handler would hand it to you, with the
  outcome every implementation owes it — and your own implementation can run
  that corpus too.

  `decodePayload` / `encodePayload` are the layer beneath (base64url ⇄ UTF-8
  JSON, size cap, version gate), and `payloadFromLocation(search)` reads the
  `?d=` query — the query is the binding, and nothing defines a fragment form.
  When a document arrives with no transport in front of it — a POST body, an
  uploaded file, a paste — `checkEnvelope(value)` applies the same envelope
  rules to an already-parsed JSON value and returns the same result and the
  same `DecodeError` reasons, so two paths into one app never answer
  differently. `decodeDocumentText(text)` is that path from file text: it
  discards a leading byte-order mark, which the File binding says a consumer
  tolerates rather than rejects, then hands the parsed value to
  `checkEnvelope`. Use it wherever you would otherwise call `JSON.parse`
  on a file, because `JSON.parse` throws on a mark some editors write without
  asking.

  Success is a `DecodedDocument`: an envelope that passed the version gate and
  carries a non-empty collection. Nothing inside a collection has been read —
  its elements are `unknown`, and `normalize` is the typed read. `CoffeeJSONDocument` is the
  producer shape, what `encodePayload` takes.

  `DECODE_ERROR_KINDS` enumerates those reasons, and
  `defaultLabels.decodeErrors` words each one, so a UI has a message for every
  reason without writing any. These are the rejections a *consumer's* intake
  gives; `fixtures/invalid/` is a different corpus — it breaks the **producer**
  gate, so most of it decodes cleanly and fails schema validation instead. The
  consumer's intake is exercised by `fixtures/transport/scan-vectors.json`.
  `FORMAT_VERSION` is the version a document you emit states,
  `SUPPORTED_MAJOR` the major this build reads, and `MEDIA_TYPE` the type a
  document travels under.

  ```ts
  import { DECODE_ERROR_KINDS, SUPPORTED_MAJOR, defaultLabels } from "@coffeejson/core";

  // A UI that owes a message per reason enumerates the array, so a reason the
  // format grows is a missing key at build time, never a blank at runtime.
  const copy = Object.fromEntries(
    DECODE_ERROR_KINDS.map((kind) => [kind, defaultLabels.decodeErrors[kind]]),
  );

  // What this build reads, for an About screen or a mismatch message — the
  // gate itself is `checkEnvelope`'s, and it already compares this constant.
  const reads = `CoffeeJSON ${SUPPORTED_MAJOR}.x`;
  ```
- **`normalize(unknown) → NormalizedDoc`** — a total function: any JSON value in,
  well-typed view-model out. It drops invalid fragments and resolves
  associated-bean pairing and ratio derivation, so an untrusted payload cannot
  crash a renderer built on it. A **projection** is the view model a renderer gets: the
  members it needs, in the shapes it needs them, with the format's derivations
  already applied. It projects all three collections, including `tastings`
  — which `@coffeejson/react` does not render, so a tasting UI is the
  consumer's to build on this projection. It projects **a chosen subset of each
  entity, not the whole document**: what a card renders. It leaves these on the
  wire, for a consumer to read from the document itself — a
  recipe's `images` and `localizations`; a bean's `certifications`, `decaf`,
  `form`, `images`, `lang`, `localizations`, `preferred_extraction`,
  `production_roaster` and `rest_days`; an origin's `type`; an addition's
  `temperature` and `note`; a step's `action_duration_s`. A step's `label` and
  `instruction` arrive **merged** as one `text`, label first, so a consumer that
  must tell an author's own label from an instruction reads them off the document.
- **Formatters** — measurement, m:ss clock, ratio, gear labels, and
  `vocabularyLabel` for any closed set; `summary()`
  one-liners for link previews.
- **Schema** — the published JSON Schema ships with the package:
  `@coffeejson/core/schema` is the runtime schema and
  `@coffeejson/core/schema/authoring` the strict authoring variant, so a
  build-time validator is offline and locked to the version it installed. The
  package brings no validator of its own; bring your own draft-2020-12 one.
- **`safeUrl`** — scheme allowlist (`https:`, `http:`, `mailto:`) for anything
  that becomes an `href`.
- **Vocabularies** — the format's closed sets as readonly token arrays with a
  union each, checked against the published schema. See below.

Zero runtime dependencies. ESM only. Runs anywhere ES2020 + `TextDecoder`/`atob`
exist: browsers, edge workers, Node ≥ 18.

## Vocabularies

**Every** closed set the format defines is vended here — there is no admission
criterion to remember — each as a readonly array of tokens with a union derived
from it: `BREW_METHODS` / `BrewMethod`, `STEP_KINDS` / `StepKind` (plus
`DEFAULT_STEP_KIND`, the kind a document means when it states none), `PROCESSES`,
`ROAST_LEVELS`, `BEAN_FORMS`, `FILTER_MATERIALS`, `GRIND_SIZES`, `QUANTITY_BASES`
(plus `DEFAULT_QUANTITY_BASIS`), `ORIGIN_TYPES`, `PARTY_TYPES` and
`PREFERRED_EXTRACTIONS`. The unit enums are five, not one, because the schema
constrains each dimension separately — `MASS_UNITS`, `WATER_UNITS` (the only one
that accepts a volume), `TEMPERATURE_UNITS`, `PRESSURE_UNITS`, `ALTITUDE_UNITS` —
with `Unit` and `UNITS` derived as their union. Two open registries vend their
*recommended* values under names that say so: `RECOMMENDED_ADDITION_TYPES` and
`RECOMMENDED_PRODUCER_ROLES` — any non-empty string is valid in those two fields,
and the recommendation exists so two producers describing one thing use one word.

Tokens only. No display strings, no lookup, no locale: labels live in
`defaultLabels`, which is keyed by these unions so a token the format grows is a
compile error rather than a blank cell. `vocabularyLabel(table, token)` is the
read — and the fallbacks below are the tables' own answer rather than a policy
the caller picks, because a set that defines `other` has it to give and the two
ordered scales do not.

**A union names what this build knows — never what a document may say.** A
consumer must accept an unknown enum value rather than reject the document, so no
growable wire field is typed by one of these. Match against them; do not gate on
them. Each set's fallback, which the tokens do not carry:

| Set | Unknown value |
| --- | --- |
| `method` · `step.kind` · `process` · `form` · `filter.material` | reads as `other` |
| `roast_level` | ignore the field, prefer `roast_agtron` |
| `grind.size` | ignore the field, prefer `setting` / `microns_approx` |

`tests/vocabularies.test.ts` reads
[`docs/schema/coffeejson-1.0.schema.json`](https://coffeejson.org/schema/1.0)
and asserts every array equals the schema's `enum` exactly, order included, so a
transcription slip fails the build instead of degrading into "unknown" silently.

## The `<coffee-json>` element

A page that is not a React app can show a document with one tag. The element
is framework-free, renders the same facts as the
[`@coffeejson/react`](https://www.npmjs.com/package/@coffeejson/react) cards,
and ships in this package.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@coffeejson/core@VERSION/dist/element/auto.js"></script>

<coffee-json src="/coffees/nano-challa.json">
  <a href="/coffees/nano-challa.json">Nano Challa, as CoffeeJSON</a>
</coffee-json>
```

Replace `VERSION` with the release you tested, and keep it pinned, because the
script runs on your page. With a bundler, import it instead:

```ts
import "@coffeejson/core/element/auto"; // registers <coffee-json>
// or register it yourself, under any name:
import { defineCoffeeJson } from "@coffeejson/core/element";
defineCoffeeJson("brew-card");
```

Both entries need a browser, because they extend `HTMLElement` when they load. In a
framework that also renders on a server, import them from code that runs
only in the browser.

**The children are the fallback.** They show until a document renders, and
they stay if the script never loads or the document does not decode, so a page
with JavaScript off keeps a working link.

| Attribute | What it does |
| --- | --- |
| `src` | A URL that serves the document. Fetched, then checked like any decoded document. |
| `d` | A payload, the same string a share link carries after `?d=`. Wins over `src`. Padding is accepted, so a template filter that emits padded URL-safe Base64 produces a valid value. |
| `units` | `metric`, `imperial` or `as-authored` (the default). |
| `lang` | A BCP-47 tag for the digits, for example `de` for a decimal comma. |
| `viewer` | A viewer's URL, absolute or a path on your site, `http` or `https` only. Adds an "Open" link to it with the payload as `?d=`. Without it there is no such link, because the package picks no host for you. |
| `viewer-label` | The text of that link, in your page's words and language. The default is "Open". The value is shown as text, never as markup. Without `viewer` it does nothing. |
| `labels` | Captions in your page's words, as JSON: a `PartialLabels` object, merged over the English defaults the way the React cards' `config.labels` is, so you name only what changes. `actions.download` is the Download button. A value that is not a JSON object keeps the defaults; the element still renders and reports nothing, because the document is fine. Every label is shown as text, never as markup. |
| `jsonld` | When present, the element adds the document's schema.org JSON-LD to the page's `<head>`, and removes it when the element goes. When absent, it adds nothing, because your page may already describe the same product. |

A page with script sets the same overrides as an object on the `labels`
property, with no JSON to escape. The property, while it is not `null`, wins
over the attribute. `viewer-label` is the Open link's text either way.

```js
document.querySelector("coffee-json").labels = {
  facts: { coffee: "Kaffee", waterTemp: "Temperatur" },
  actions: { download: "Herunterladen" },
};
```

When a document cannot be shown, the element sets `data-error` to the
failure's name and fires `coffeejson-error` with it as `detail.kind`. The
names are the ones `DECODE_ERROR_KINDS` lists, plus `fetch_failed`
for a `src` that could not be fetched. A document that decodes and holds no
bean or recipe the element can draw fails as `empty_document`.
`coffeejson-load` fires when a document renders, and `element.document` holds
it. Both events bubble and cross shadow boundaries, so one listener on
`document` receives the events of every tag on the page.

**Styling.** The element draws the card in a shadow root, so your page's CSS does not
apply inside it. Theme it with the custom properties `--cj-accent`,
`--cj-fg`, `--cj-muted`, `--cj-bg`, `--cj-border`, `--cj-radius`, `--cj-space`
and `--cj-font`, set on the element. Style a single part with `::part()`. Every
class name the React cards use is a part, for example
`coffee-json::part(cj-title)` or `coffee-json::part(cj-bean-card)`. A link
inside a card is `cj-link`, the Download button is `cj-download`, and the
viewer link is `cj-open`.

**A document is untrusted input.** Every value reaches the page as text, never
as markup, and a URL becomes a link only when it is `http`, `https` or
`mailto`.

## schema.org JSON-LD export

A page that renders a CoffeeJSON recipe can also expose it to search engines
and agents as [schema.org `Recipe`](https://schema.org/Recipe) structured
data, and a page that renders a bean as [`Product`](https://schema.org/Product)
([below](#a-bean-as-product)). `@coffeejson/core` ships both exporters:

```ts
import { recipeJsonLd } from "@coffeejson/core";

const ld = recipeJsonLd(doc, 0, { url: "https://example.com/recipes/sunday-v60" });
// null when the input is unexportable (no recipe at that index, or no usable title)
```

`documentJsonLd(doc, { url })` applies both to a whole document, by the rule
a page wants: every recipe as a `Recipe` node, or, when the document has no
recipe, every bean as a `Product` node.

The caller serializes and embeds the result:

```html
<script type="application/ld+json">{ …the returned object… }</script>
```

When serializing into an inline `<script>`, escape `<` (for example
`JSON.stringify(ld).replace(/</g, "\\u003c")`) so no string member can close
the tag.

### The mapping

`@context: "https://schema.org"` · `@type: "Recipe"`. `Recipe` is a `HowTo`
subtype, which is what legitimizes `tool` and `performTime`.

| CoffeeJSON | JSON-LD | Rule |
| --- | --- | --- |
| `title` | `name` | verbatim (a recipe without a usable title exports `null`) |
| `description` | `description` | verbatim |
| `images` | `image` | the array, verbatim |
| `author` | `author` | `Person`/`Organization` by the party's `type`; absent `type` reads as `Person` (the author role's default); a party without a usable `name` is omitted |
| `based_on` | `isBasedOn` | the URL, verbatim |
| `date_published` | `datePublished` | verbatim (both ISO 8601 calendar dates) |
| `lang` | `inLanguage` | verbatim (both BCP-47) |
| `finish_s` | `performTime` | ISO 8601 duration — `150` → `"PT150S"` |
| `yield` | `recipeYield` | the rendered mass, for example `"47 g"` — never a fabricated cup count |
| `coffee` + the associated bean | `recipeIngredient[0]` | `"15 g coffee — Nano Challa (Example Roastery)"`; the bean resolves per the [association rules](https://coffeejson.org/docs/spec/02-envelope.md#association-explicit-reference) (`bean_ref`, else single-bean co-location); unlinked → `"15 g coffee"` |
| `water` | `recipeIngredient[]` | `"250 g water"` |
| `additions[]` | `recipeIngredient[]` | one per addition, the registry value verbatim — `"120 g ice"`, `"100 g milk (oat)"` (`note` in parentheses) |
| `steps[]` | `recipeInstructions[]` | one `HowToStep` per step with something human to say: `text` = `instruction`, else the pour-target derivation (`"Pour to 250 g"`); a step with neither is skipped. An author-customized `label` is exported as the step `name` |
| `brewer` / `basket` / `grind.grinder` | `tool[]` | `HowToTool`, named by `label`, else brand + model, else the id |

The optional `url` option is the page's canonical URL — page knowledge, not
document data — and lands on the JSON-LD `url` member.

### A bean as `Product`

A page that renders a bean — a roaster's product page, a directory of bags —
exports it as [schema.org `Product`](https://schema.org/Product) the same way:

```ts
import { beanJsonLd } from "@coffeejson/core";

const ld = beanJsonLd(doc, 0, { url: "https://example-roastery.com/products/nano-challa" });
// null when the input is unexportable (no bean at that index, or no usable name)
```

The node carries **no `offers`**. Price, stock and lot size are the listing's
facts, not the coffee's ([Overview § Design principles](https://coffeejson.org/docs/spec/01-overview.md#design-principles),
principle 4); a roaster's page already has an offer, and a page that is not
the listing points at it with `sameAs`. The identity is exported as
`additionalProperty` under the CoffeeJSON member names with the wire values
verbatim, so a reader that knows the format reads it straight back.

| CoffeeJSON | JSON-LD | Rule |
| --- | --- | --- |
| `name` | `name` | verbatim (a bean without a usable name exports `null`) |
| `url` | `sameAs` | the roaster's listing, verbatim — omitted when it equals the page `url`, because then the page *is* the listing |
| `description` | `description` | verbatim |
| `images` | `image` | the array, verbatim |
| `roaster` | `brand` | `Organization`/`Person` by the party's `type`; absent `type` reads as `Organization` (the roaster role's default); a party without a usable `name` is omitted |
| `origin.items[].country` | `countryOfOrigin` | one `Country` node per distinct code, in stated order; a single-country origin exports one node, not an array. The code is exported as `identifier`, never as `name` — an alpha-2 code is not what a country is called, and the format carries no display name to put there |
| `roast_date` | `productionDate` | verbatim (both ISO 8601 calendar dates) |
| a **single lot**'s `region` · `producers[]` · `altitude` · `harvest_time` | `additionalProperty[]` | one `PropertyValue` each (`producer` per named party; `altitude` as `value` or `minValue`/`maxValue` with UN/CEFACT `unitCode` `MTR`/`FOT`). Exported only when the origin has exactly one item: a blend's per-component facts belong to a component the node cannot name, so a blend exports its countries and nothing finer |
| `process` · `drying_method` · `varietals` · `roast_level` · `roast_agtron` · `rest_days` · `production_roaster` · `decaf` · `form` · `preferred_extraction` · `certifications` · `roaster_notes` | `additionalProperty[]` | one `PropertyValue` each, `name` = the member name, `value` = the wire value verbatim (arrays stay arrays; `rest_days` as `minValue`/`maxValue` with `unitText: "day"`) |
| `origin.items[].process` · `origin.items[].varietals` | `additionalProperty[]` | only where the bean states none of its own. **One lot** is the bag, so both fall back to it. **Several lots**: `process` exports the distinct union across them — [`processList`](https://coffeejson.org/docs/spec/06-vocabularies.md) reads a multi-process list at bag level as "the bag contains coffee of each", so the union is the format's own reading — and `varietals` does not, because every lot's varieties in one list describes no coffee in the bag |

Never exported: `id`, `lang`, `localizations` (document mechanics and hints);
`origin.type` (already implied by the count of `countryOfOrigin` nodes); each
producer's `role` (the party exports as its name); and the remaining
`origin.items[]` members — `name` and `percentage` — which name or weight a
component this node has no way to itemize.

### What is never exported

The exporter is **document-true**: absent data stays absent, and nothing is
fabricated for the sake of search features.

- **No `offers`, `price`, `aggregateRating` or `review` on a `Product`** —
  the format carries none of them, by design.

- No `aggregateRating`, `nutrition`, servings, or `keywords` — CoffeeJSON
  carries none of these.
- **No `prepTime`/`cookTime`/`totalTime`.** `finish_s` is the length of the
  pour schedule, which is exactly what schema.org means by `performTime`
  ("not including time to prepare the supplies"). `totalTime` would
  additionally claim the grinding and heating the document never describes —
  it is silent on those, not asserting they are free. **Know the cost.**
  Google's Recipe rich result reads `prepTime`/`cookTime`/`totalTime` and
  does not document `performTime`, so a page relying on this export alone
  shows no time in search results. A publisher willing to stand behind an
  end-to-end figure for its own editorial pages can add `totalTime` at the
  page layer; that is the publisher's claim to make about its own content,
  and not one an exporter can make on an author's behalf.
- **No `image` the document does not carry.** A recipe without `images`
  exports without an `image` member, even though image-less recipes are not
  eligible for search rich results — a page must not present art the
  recipe's author did not attach.
- `generator` (software provenance — consumers must not depend on it),
  `bean_ref` and `recommended` (document mechanics), `notes`, and the
  numbers with no schema.org slot (`ratio`, `water_temp`, `grind` values,
  `pressure`, `preinfusion_s`). Authors who want those in the instructions
  put them in step `instruction` text, which exports verbatim.

### Rendering language

Ingredient strings and derived step labels are the one place the exporter
renders human text; v1 renders them in English. Everything else passes
through verbatim, so a document's own language (titles, instructions,
`description`) is preserved and declared via `inLanguage`.

This package tracks a format that can still change in place: a format change
ships as a package release, and a breaking API change is a major bump
([Versioning § What you can rely on today](https://coffeejson.org/docs/spec/07-versioning.md#what-you-can-rely-on-today)).
