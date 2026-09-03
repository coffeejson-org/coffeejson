#!/usr/bin/env node
// The runtime schema is deliberately open (forward compatibility); this variant
// closes every object and flags empty optional arrays so producer pipelines catch
// typo'd field names. A producer lint only — never a conformance or import gate.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const runtimePath = join(root, "docs", "schema", "coffeejson-1.0.schema.json");
const authoringPath = join(root, "docs", "schema", "coffeejson-1.0.authoring.schema.json");
const gearPath = join(root, "registries", "gear.json");

/** Every id and alias in the gear registry — the ids a document authored HERE may use. */
function registeredGearIds() {
  const { gear } = JSON.parse(readFileSync(gearPath, "utf8"));
  return gear.flatMap((e) => [e.id, ...(e.aliases ?? [])]).sort();
}

export function buildAuthoringSchema(runtime, registeredIds = registeredGearIds()) {
  const schema = structuredClone(runtime);
  // A variant is `/schema/<variant>/<version>`, variant FIRST because
  // `/schema/1.0` is served as a file and a path cannot be both file and
  // directory. Version last keeps a variant's addresses parallel to the runtime's.
  schema.$id = "https://coffeejson.org/schema/authoring/1.0";
  schema.title = "CoffeeJSON Document (authoring)";
  schema.description =
    "Strict authoring/lint variant of the CoffeeJSON 1.0 schema, GENERATED from it by tools/gen-authoring-schema.mjs — do not edit by hand. Every object is closed (unknown members rejected, catching producer typos) except the reserved `ext` member, admitted on every entity but a localization as an object with non-empty keys and its contents unconstrained, every optional array requires at least one element (emit content or omit the key), and a document carrying several beans requires bean_ref on every recipe (co-location associates nothing once there is more than one coffee, so an unreferenced recipe is silently unlinked). A producer lint only: the open runtime schema at https://coffeejson.org/schema/1.0 is the conformance schema, and consumers never gate imports on either.";
  walk(schema);
  // A localization carries wording and nothing else: every quantity, unit, enum
  // and reference belongs to the entity and is the same in every language. `ext`
  // is not wording, and 07-versioning reserves it on the entities this
  // specification defines rather than on an overlay of one. 03-recipe.md and
  // 04-bean.md both state the lint rejects any other member here, and they are
  // right, so the reserved name is withdrawn from the three overlays.
  for (const def of ["recipeLocalization", "stepLocalization", "beanLocalization"])
    delete schema.$defs?.[def]?.properties?.ext;
  // An authoring RULE on the Gear object. The registry is authoritative for a
  // known id, so `brand`/`model` on one can only drift from it — measured at 24
  // drifting members across 47 known-id gear objects before this landed. NOT a
  // runtime rule: the open schema tolerates them, and a consumer that meets them
  // ignores them for a known id per the matching rule. They keep their real job,
  // which is the structured, queryable form for OFF-registry gear, where there is
  // no entry to consult and a free `label` is all a consumer would otherwise have.
  // Scoped to THIS repo's corpus by listing the ids it may use: a third-party
  // producer with a real-but-unregistered slug (`modbar-av`) is exactly the case
  // 03-recipe.md's fallback exists for, and must keep brand/model. The published
  // authoring schema is a lint for documents authored here, not a conformance gate.
  if (schema.$defs?.gear) {
    schema.$defs.gear.allOf = [...(schema.$defs.gear.allOf ?? []), {
      $comment: "Authoring lint: brand/model belong to off-registry gear. For an id this registry carries, the registry supplies them and a copy in the document only drifts from it. An unregistered id keeps them — they are the fallback a consumer has left.",
      if: { type: "object", required: ["id"], properties: { id: { enum: registeredIds } } },
      then: { type: "object", not: { anyOf: [{ required: ["brand"] }, { required: ["model"] }] } },
    }];
  }
  // An authoring RULE, not a transform. Co-location associates on
  // `beans.length == 1`, so adding a second bean to a bag-to-brew document
  // silently unlinks every recipe: still valid, now meaning something else. NOT a
  // runtime rule — an unreferenced recipe in a multi-bean document is legal.
  // Added after `walk` so the transform never sees it.
  schema.allOf = [...(schema.allOf ?? []), {
    $comment: "Authoring lint: once a document carries several beans, co-location associates nothing, so each recipe must name the coffee it is for.",
    if: { required: ["beans"], properties: { beans: { type: "array", minItems: 2 } } },
    // Types stated so the fragment is well-formed on its own: ajv strict mode
    // warns on `items` and `required` that do not say what they apply to.
    then: { properties: { recipes: { type: "array", items: { type: "object", required: ["bean_ref"] } } } },
  }];
  return schema;
}

function walk(node) {
  if (Array.isArray(node)) {
    node.forEach(walk);
    return;
  }
  if (node === null || typeof node !== "object") return;
  // Only real object schemas: the envelope anyOf branches and the basis if/then
  // fragments carry partial `properties` without a `type`, and closing those would
  // reject the members the main schema defines.
  if (node.type === "object" && node.properties) {
    node.additionalProperties = false;
    // `ext` is reserved by NAME in 07-versioning, so admit the name and
    // constrain no CONTENTS. Closed without it, a conforming vendor member reads
    // as a typo and the author must strip it to lint at all.
    // The container is not contents. 07-versioning reserves the shape
    // `{ <vendor id>: … }`, and admitting the bare `true` schema let the lint
    // accept `ext: null` — which 01-overview forbids of every member, absence
    // being the null — along with a string, an array and a bare number. A vendor
    // id is also never the empty string. Neither says anything about what a
    // vendor puts inside, which stays undefined until an adopter needs it.
    // `??=` so a future minor that gives `ext` a real definition keeps it: the
    // lint defers to the runtime schema rather than overwriting it.
    node.properties.ext ??= { type: "object", propertyNames: { minLength: 1 } };
  }
  // Empty optional arrays are valid on the wire, and a should-omit here.
  if (node.type === "array" && node.minItems === undefined) node.minItems = 1;
  for (const value of Object.values(node)) walk(value);
}

export function renderAuthoringSchema(runtime) {
  return JSON.stringify(buildAuthoringSchema(runtime), null, 2) + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const runtime = JSON.parse(readFileSync(runtimePath, "utf8"));
  writeFileSync(authoringPath, renderAuthoringSchema(runtime));
  console.log(`wrote ${authoringPath}`);
}
