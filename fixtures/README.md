# Fixtures

Canonical CoffeeJSON documents — the conformance corpus for the
[schema](../docs/schema/coffeejson-1.0.schema.json). `pnpm test`
([`tools/validate-fixtures.mjs`](../tools/validate-fixtures.mjs)) checks, in CI
and locally:

1. every document in `valid/` validates against the schema;
2. every document in `invalid/` is rejected by it;
3. every fenced ```json block in the repo's Markdown that is a *complete
   document* (parses as JSON and carries a `coffeejson` member) validates too —
   fragments and illustrative pseudo-JSON are skipped automatically;
4. the **authoring schema** (the strict, generated variant) has no drift from
   its generator, accepts every valid fixture and corpus document except the
   deliberate runtime-leniency fixtures (unknown-member and empty-array
   probes, exempted by name in the harness), and rejects a typo'd field the
   open runtime schema accepts.

## What "invalid" means here

The JSON Schema is the **producer** gate: it accepts only what v1.0 defines, so
emitting software can be linted strictly. Consumer runtime behavior is
deliberately more lenient — per the
[forward-compatibility contract](../docs/spec/01-overview.md#the-forward-compatibility-contract-summary)
a consumer MUST NOT reject a document over unknown members or unknown enum
values (it maps them to each vocabulary's fallback). That is why
`invalid/unknown-method.json` is schema-invalid yet must still not crash a
conformant consumer.

`invalid/` therefore breaks the **producer** gate, not a consumer's intake: most
of these documents decode cleanly through a consumer's transport and envelope
checks and fail only schema validation. What a consumer's intake owes is
exercised by [`transport/scan-vectors.json`](transport/scan-vectors.json).

Two spec rules are semantic and outside JSON Schema's reach — bean `id`
uniqueness and `bean_ref` resolution
([Envelope § Association](../docs/spec/02-envelope.md#association-explicit-reference)).
They belong to a future semantic validator's warning set, not to this corpus.

## valid/

| Fixture | Exercises |
| --- | --- |
| `minimal.json` | The smallest conformant document. |
| `typical-pour-over.json` | Method, brewer, ratio, temperature, timed steps, finish. |
| `non-metric-units.json` | `ounce` / `fahrenheit` / `foot` unit identifiers. |
| `addition-unquantified-ice.json` | An addition with no `amount` — the source lists ice without a mass, and the recipe is still marked iced. |
| `valve-and-wait-steps.json` | A valved brewer used both ways in one recipe — shut to steep, opened to drain — plus `wait` and `drawdown`. |
| `filter-and-rest.json` | A paper filter with its product label and a rinse as a `prep` step, a metal one stated positively, and both shapes of `rest_days` (a lower bound alone, and a window). |
| `origin-item-varietals.json` | Varieties per blend component — eight across four, which a single bean-level list would misstate as one mixture. |
| `process-multiple.json` | A coffee that underwent two processes ("Double Anaerobic Honey"), a blend whose set is stated without assignment, and `wet_hulled` on a Sumatran component. |
| `water-by-volume.json` | Brew water stated in millilitres, with the per-pour targets in the same unit — the shape a source publishing `お湯 92℃ 225cc` produces. |
| `bilingual-bag.json` | A roaster publishing one coffee and one method in two languages: base fields in Japanese, the roaster's own English in `localizations`. Shows a partly-translated step list (the middle step's `{}`) and a `roaster_notes` list replaced whole. |
| `ranged-quantities.json` | Measurements as stated windows: an espresso whose dose, yield and temperature are each their own window, and a French press guide whose dose and water scale together — the coupling carried by `ratio`. |
| `aeropress-mixed-steps.json` | Mixed timed and untimed step kinds, the press carrying `action_duration_s`. |
| `full-bean-and-recipe.json` | The flagship co-located pair — a fully populated bean with a richly populated filter recipe (attribution, images, publication date, three-view grind). |
| `library-export.json` | Multiple recipes in one document. |
| `forward-compat-unknown-fields.json` | Unknown members at several depths still validate. |
| `newer-minor-version.json` | `"coffeejson": "1.7"` accepted by the 1.x schema. |
| `forward-compat-unknown-registry-values.json` | The half the other two leave out: unknown values in the **open registries** — an `addition.type` and a producer `role` no 1.0 registry lists — carried by a later minor alongside unknown members at three depths. `forward-compat-unknown-fields.json` covers unknown *members*, `newer-minor-version.json` covers the *version*; an unrecognized registry value is neither, and the vocabularies' stated fallbacks are the runtime half of the same contract. |
| `bag-to-brew.json` | One bean + recipes by co-location, `recommended` picks. |
| `catalog-with-refs.json` | Multi-bean catalog: `id`, `bean_ref`, `recommended`. |
| `bean-only.json` | A coffee's identity with no recipe. |
| `tasting-measured-cup.json` | A full outcome: bean + recipe + a tasting carrying rating, both perceived axes, descriptors — including a two-word one, since descriptors are display text — and a measured `tds`. |
| `tasting-refractometer-only.json` | A tasting with a reading and no opinion — `measured.tds` alone, no rating or perceived axes. |
| `tasting-bean-substitution.json` | A tasting whose own `bean_ref` names a different coffee than the recipe it followed — "I brewed your recipe with my coffee", the case the tasting's reference wins. |
| `tasting-weighed-cup.json` | The beverage actually weighed — `measured.yield` beside `measured.tds`, on an immersion recipe stated by water and carrying no target `yield` of its own, the case extraction yield could not otherwise be derived for. |
| `tasting-ids-and-lang.json` | Two cups of one recipe, each named by its own `id` and hinting its note's language with `lang` — position is not an identity, and a tasting's words have a language. |
| `bean-catalog.json` | Several distinct coffees, no recipes. |
| `blend-percentages.json` | A blend as ONE bean with per-origin `percentage`. |
| `espresso-dose-yield.json` | A yield-basis (`basis:"yield"`) espresso recipe: required `yield`, `pressure`, `preinfusion_s`, `basket`, and the `distribute` / `tamp` / `pull` step kinds. |
| `filter-with-yield.json` | A water-basis recipe MAY state `yield` alongside its required `water`. |
| `lang-bcp47.json` | A `lang` carrying script + region subtags (`zh-Hant-TW`) validates. |
| `recipe-with-author.json` | `author` (a [Party](../docs/spec/03-recipe.md#party-object)) + the `based_on` citation. |
| `credit-roles.json` | `role` on credits that are not producers — the barista who developed the recipe on `author`, the roaster's own part on `roaster`. It is an ordinary member of every [Party](../docs/spec/03-recipe.md#party-object). |
| `bloom-step.json` | The `bloom` step kind — pour-type, timed, carrying `to_water`. |
| `grind-size.json` | Qualitative `grind.size` beside the grinder's own `setting`. |
| `action-duration.json` | `action_duration_s` on a step. |
| `additions-milk-temp.json` | Open-registry addition `type` (`milk`) with `temperature` and `note`. |
| `form-drip-bag.json` | `form: "drip_bag"` from the widened form enum. |
| `images.json` | `images` arrays on both a recipe and a bean (always an array; one or many). |
| `images-empty.json` | An empty `images` array is valid — equivalent to absent, like the other optional arrays. |
| `date-published.json` | `date_published` (ISO 8601 date) beside `author`/`based_on`. |
| `recipe-description.json` | The recipe's one-line `description` beside its long-form `notes`. |
| `gear-custom.json` | The gear escape hatch: `id: "custom"` + `label` on both a brewer and a grinder. |
| `gear-variant.json` | `variant` on all three gear slots: the registry names the family (`hario-v60`, `vst-precision`, `varia-vs3`) and the document names which one of it — a size, a dose and a generation, none of them a slug. |
| `vendor-ext.json` | The reserved vendor-extension home: vendor-private data under `ext`, keyed by vendor id, validates today ([Versioning § Reserved extensions](../docs/spec/07-versioning.md#reserved-extensions)), on a recipe and on its brewer. |
| `recipe-ratio-instead-of-water.json` | A water-basis recipe stating `ratio` and no `water` — the dose plus the ratio fixes the brew, and recipes are commonly published that way ("20 g at 1:15"). |
| `recipe-ratio-disagrees-with-water.json` | A stated `ratio` that its own `coffee` and `water` contradict. The document is conformant; the measurements are authoritative, so a consumer shows 1:15 and not the stated 16.7. |
| `recipe-ids.json` | Recipe `id`s beside a bean `id` and `bean_ref` — several recipes for one coffee, each addressable on its own. |
| `blend-components-unknown.json` | A blend that names no components: `origin.type: "blend"` with no `items`, for a roaster who does not publish what is in it. |
| `origin-producers-roles.json` | `producers` on an origin item carrying `role` and `type` — a named grower and the farm they work, told apart. |
| `origin-supranational-region.json` | Blend components stated at different geographic granularities: a country with its department, and a multi-country region carrying no `country` at all. |

## invalid/

| Fixture | Fails on | Violates |
| --- | --- | --- |
| `missing-version.json` | `required:coffeejson` | `coffeejson` is required. |
| `version-not-string.json` | `type:coffeejson` | `coffeejson` must be a semver string. |
| `no-collections.json` | `anyOf` | At least one of `beans` / `recipes` must be present. |
| `empty-collections.json` | `minItems:beans` | …and non-empty. |
| `recipe-missing-water.json` | `anyOf:recipes` | A water-basis recipe (`basis:"water"`, or absent) must state its brew water as either `water` or `ratio`; this one states neither. |
| `recipe-missing-title.json` | `required:recipes.title` | `title` is required on every recipe. |
| `display-unit-symbol.json` | `enum:coffee.unit` | Units are canonical ids (`gram`), never symbols (`g`). |
| `measurement-missing-unit.json` | `required:water.unit` | A measurement always carries `unit`. |
| `unknown-method.json` | `enum:method` | Producers may not invent method ids (consumer leniency is a runtime rule, not a schema rule). |
| `espresso-missing-yield.json` | `required:yield` | A yield-basis recipe REQUIRES `yield` ([Recipe § Espresso](../docs/spec/03-recipe.md#espresso-dose--yield)). |
| `espresso-with-water.json` | `false schema:water` | A yield-basis recipe MUST NOT carry `water`. |
| `espresso-with-ratio.json` | `false schema:ratio` | A yield-basis recipe MUST NOT carry `ratio`. |
| `bad-country-code.json` | `pattern:country` | `country` is ISO 3166-1 alpha-2. |
| `bad-lang-tag.json` | `pattern:lang` | `lang` is a BCP-47 tag; `en_US` (POSIX locale, underscore) is rejected. |
| `dose-by-volume.json` | `enum:coffee.unit` | `milliliter` is brew water only — a dose is always a mass. |
| `measurement-no-magnitude.json` | `anyOf:coffee` | A Measurement needs `value`, `min`, or `max` — a unit alone states no quantity. |
| `altitude-without-bounds.json` | `anyOf:altitude` | Altitude needs `value`, `min`, or `max`. |
| `altitude-missing-unit.json` | `required:altitude.unit` | Altitude always carries `unit` (`meter` or `foot`) — bounds alone are unit-less noise. |
| `origin-items-empty.json` | `minItems:items` | An `items` array, once present, carries at least one component — an empty one states nothing. |
| `measurement-value-and-window.json` | `false schema:coffee.min` | A Measurement states a point (`value`) or a window (`min`/`max`), never both at once. |
| `recipe-id-empty.json` | `minLength:recipes.id` | A recipe `id`, once present, is non-empty — an empty string addresses nothing. |
| `negative-step-time.json` | `minimum:at_s` | `at_s` starts at zero. |
| `ratio-zero.json` | `exclusiveMinimum:ratio` | `ratio` is strictly positive. |
| `author-missing-name.json` | `required:author.name` | An `author` party requires `name`. |
| `based-on-not-uri.json` | `format:based_on` | `based_on` must be a well-formed URI. |
| `grind-size-unknown.json` | `enum:size` | `grind.size` is a closed enum; producers may not invent values. |
| `action-duration-negative.json` | `minimum:action_duration_s` | `action_duration_s` starts at zero. |
| `bean-url-not-uri.json` | `format:beans.url` | `bean.url` must be a well-formed URI. |
| `generator-url-not-uri.json` | `format:generator.url` | `generator.url` must be a well-formed URI. |
| `generator-missing-name.json` | `required:generator.name` | `generator` names the software or states nothing: `name` is required. |
| `localizations-without-lang.json` | `dependentRequired:lang` | `localizations` requires `lang` — an overlay needs a base language to override. |
| `localizations-bad-locale-key.json` | `pattern:localizations` | Locale keys are well-formed BCP-47 tags; `english` is not one. |
| `author-url-not-uri.json` | `format:author.url` | A party's `url` (here recipe `author`) must be a well-formed URI. |
| `images-single-string.json` | `type:images` | `images` is always an array — a bare string is rejected (a single image is an array of one). |
| `date-published-not-date.json` | `pattern:date_published` | `date_published` is an ISO 8601 calendar date, not free-text. |
| `party-type-unknown.json` | `enum:author.type` | A party's `type` is the closed enum `person` · `organization`. |
| `roaster-bare-string.json` | `type:roaster` | `bean.roaster` is a party object, not a bare string. |
| `roaster-missing-name.json` | `required:roaster.name` | A `roaster` party requires `name`, like every party. |
| `title-empty.json` | `minLength:recipes.title` | The required `title` is never the empty string. |
| `author-name-empty.json` | `minLength:author.name` | A party's required `name` is never the empty string. |
| `author-role-empty.json` | `minLength:author.role` | A party's `role` is never the empty string, wherever the party sits. |
| `agtron-above-scale.json` | `maximum:roast_agtron` | `roast_agtron` stays on the 0–100 Gourmet scale. |
| `version-wrong-major.json` | `pattern:coffeejson` | The 1.0 schema validates major version 1 only — a `2.0` document is out of its scope (the consumer [version gate](../docs/spec/07-versioning.md#the-version-gate), not this schema, governs import). |
| `version-prefixed.json` | `pattern:coffeejson` | `coffeejson` is the bare semver string — `v1.0` (prefixed) is rejected. |
| `percentage-above-100.json` | `maximum:percentage` | A blend component's `percentage` stays within 0–100. |
| `tasting-tds-not-a-percentage.json` | `exclusiveMinimum:tds` | A tasting's measured `tds` is strictly positive — zero percent dissolved solids is water, not coffee. |
| `tasting-tds-above-100.json` | `maximum:tds` | `tds` is a percentage by mass, so 101 is not a surprising reading but an impossible one — the upper bound the schema states. |
| `tasting-rating-off-scale.json` | `maximum:rating` | A tasting `rating` is 1–5; a 9 is off the scale the field defines. |
| `tasting-axis-out-of-range.json` | `maximum:extraction` | A perceived-dial-in axis runs -1 to 1; 2.5 is off the compass. |
| `tasting-id-empty.json` | `minLength:tastings.id` | A tasting `id` names something; an empty string names nothing, the same rule a recipe's `id` follows. |
| `measurement-negative-value.json` | `exclusiveMinimum:coffee.value` | A mass measurement's `value` is never negative. |
| `addition-type-empty.json` | `minLength:additions.type` | An addition's required `type` is never the empty string. |
| `roast-date-malformed.json` | `pattern:roast_date` | `roast_date` is an ISO 8601 calendar date — `20/06/2026` is rejected. |
| `gear-id-malformed.json` | `pattern:brewer.id` | A gear `id` is a lowercase kebab-case slug (or `custom`) — a mis-cased id would silently fail byte-exact registry matching. |
| `gear-missing-id.json` | `required:brewer.id` | Gear always carries `id` — a registry slug or the literal `custom`; brand/model/label alone do not identify it. |
| `gear-custom-without-label.json` | `required:brewer.label` | `id: "custom"` names no registry entry, so `label` is what a consumer has to show — the one id that requires it. |
| `measurement-zero-value.json` | `exclusiveMinimum:coffee.value` | A mass measurement's `value` is strictly positive — a zero-gram dose states nothing. |
| `pressure-zero.json` | `exclusiveMinimum:pressure.value` | `pressure` is strictly positive — zero bar is not a brew pressure. |
| `microns-zero.json` | `exclusiveMinimum:microns_approx` | `microns_approx` is strictly positive. |
| `recipes-element-not-an-object.json` | `type:recipes` | A collection element that is not an object — a slot claiming an entity and holding a number. The schema refuses it; what an importer does with it is [Envelope § Fields](../docs/spec/02-envelope.md#fields) prose. |

## transport/

[`bom-prefixed-file.json`](transport/bom-prefixed-file.json) — a conformant
document written to a file behind a real UTF-8 byte-order mark, the shape an
editor or runtime produces on its own
([Transport § File](../docs/transport.md#file)). It is bytes rather than a
document, so it is checked outside the `valid/` sweep: the harness asserts the
mark is still there, then that discarding it leaves a document the schema
accepts. Both halves matter — a fixture that quietly lost its mark would keep
passing the second check while testing nothing.

[`scan-vectors.json`](transport/scan-vectors.json) — executable scan-input
test vectors for the share-URL binding
([Transport § Accepting links from any host](../docs/transport.md#accepting-links-from-any-host)):
URLs exactly as a QR scanner or link handler would receive them, each with its
expected outcome (`document` — extraction succeeds and yields precisely the
embedded document; `reject` — extraction fails, and the stated reason must be
the reason the implementation actually gives, so a vector cannot pass by
rejecting for the wrong cause). A `reject` vector states that reason twice: as
`kind`, the machine-readable name from the
[failure vocabulary](../docs/integration-guide.md) every implementation reports,
and as `reason`, the same thing in the words of
[Transport § Encoding](../docs/transport.md#encoding). A harness asserts on
`kind`; keeping its own name-per-vector table is how two implementations grow
two dialects of one vocabulary. Both payload forms are present — plain and
zlib-compressed, including a small-window stream that does not begin `0x78`,
a stream that inflates past the size cap, and one whose checksum is
damaged — so an implementation that reads only one form, tests the wrong byte,
inflates unbounded, skips the checksum, waves through a major version it does not
read, or gates on a version spelling the wire grammar does not define fails the
corpus. The harness runs
every vector through the § Encoding algorithm; SDK implementations are
encouraged to run the same corpus.
