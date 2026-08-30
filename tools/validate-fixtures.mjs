#!/usr/bin/env node
// Validates the CoffeeJSON schema and everything that claims to conform to it:
//   1. the schema itself compiles (JSON Schema draft 2020-12);
//   2. every fixtures/valid/*.json document validates;
//   3. every fixtures/invalid/*.json document is rejected;
//   4. every fenced ```json block in README.md and docs/**/*.md that is a
//      complete document (parses, and carries a "coffeejson" member)
//      validates. Fragments and pseudo-JSON blocks are skipped.
// Exits non-zero on any unexpected result.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { AUTHORING_SCHEMA_PATH, SCHEMA_PATH, schemaCompiler } from "./compile-schema.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

const ajv = schemaCompiler();
const validate = ajv.compile(JSON.parse(readFileSync(SCHEMA_PATH, "utf8")));

let checked = 0;
let failures = 0;

const ok = (label) => {
  checked++;
  console.log(`  ok  ${label}`);
};
const fail = (label, detail) => {
  checked++;
  failures++;
  console.error(`FAIL  ${label}`);
  if (detail) console.error(detail.replace(/^/gm, "      "));
};
const errorText = () =>
  (validate.errors ?? [])
    .map((e) => `${e.instancePath || "/"} ${e.message}`)
    .join("\n");

const jsonFiles = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));

console.log("fixtures/valid — every document must validate");
for (const file of jsonFiles(join(root, "fixtures", "valid"))) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  validate(doc) ? ok(relative(root, file)) : fail(relative(root, file), errorText());
}

console.log("\nfixtures/invalid — every document must be rejected");
for (const file of jsonFiles(join(root, "fixtures", "invalid"))) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  validate(doc)
    ? fail(relative(root, file), "validated, but this fixture must be rejected")
    : ok(relative(root, file));
}

console.log("\nrecipes/ — every corpus document must validate");
const recipesDir = join(root, "recipes");
const recipeFiles = jsonFiles(recipesDir).filter((f) => basename(f) !== "catalog.json");
for (const file of recipeFiles) {
  const doc = JSON.parse(readFileSync(file, "utf8"));
  validate(doc) ? ok(relative(root, file)) : fail(relative(root, file), errorText());
}

console.log("\nrecipes/catalog.json — entries and files match 1:1");
const catalog = JSON.parse(readFileSync(join(recipesDir, "catalog.json"), "utf8"));
const catalogSlugs = new Set(catalog.recipes.map((r) => r.slug));
const fileSlugs = new Set(recipeFiles.map((f) => basename(f, ".json")));
for (const slug of catalogSlugs)
  fileSlugs.has(slug) ? ok(`catalog → ${slug}.json`) : fail(`catalog → ${slug}.json`, "no such file");
for (const slug of fileSlugs)
  catalogSlugs.has(slug) ? ok(`${slug}.json → catalog`) : fail(`${slug}.json → catalog`, "no catalog entry");

console.log("\nstep schedules — `at_s` and `to_water` never go backwards in array order");
// Recipe § Step object: a producer SHOULD emit both non-decreasing, and a consumer
// may not reorder to repair one that does not — so a backwards corpus document
// would publish a schedule no conformant reader can fix.
const firstMagnitude = (m) => {
  if (typeof m !== "object" || m === null) return null;
  for (const key of ["value", "max", "min"]) if (typeof m[key] === "number") return m[key];
  return null;
};
const scheduleBreaks = (doc) => {
  const breaks = [];
  for (const [r, recipe] of (Array.isArray(doc.recipes) ? doc.recipes : []).entries()) {
    const last = { at_s: null, to_water: null };
    for (const [i, step] of (Array.isArray(recipe.steps) ? recipe.steps : []).entries()) {
      if (typeof step !== "object" || step === null) continue;
      const seen = { at_s: typeof step.at_s === "number" ? step.at_s : null, to_water: firstMagnitude(step.to_water) };
      for (const field of ["at_s", "to_water"]) {
        if (seen[field] === null) continue;
        if (last[field] !== null && seen[field] < last[field])
          breaks.push(`recipes[${r}].steps[${i}] ${field} ${seen[field]} follows ${last[field]}`);
        last[field] = seen[field];
      }
    }
  }
  return breaks;
};
for (const file of [...recipeFiles, ...jsonFiles(join(root, "fixtures", "valid"))]) {
  const breaks = scheduleBreaks(JSON.parse(readFileSync(file, "utf8")));
  breaks.length === 0 ? ok(`schedule ${relative(root, file)}`) : fail(`schedule ${relative(root, file)}`, breaks.join("\n"));
}

console.log("\nmarkdown examples — every complete ```json document must validate");
const mdFiles = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...mdFiles(p));
    else if (entry.endsWith(".md")) out.push(p);
  }
  return out;
};
let skipped = 0;
for (const file of [join(root, "README.md"), ...mdFiles(join(root, "docs")).sort()]) {
  const md = readFileSync(file, "utf8");
  let index = 0;
  for (const m of md.matchAll(/```json\n([\s\S]*?)```/g)) {
    index++;
    const label = `${relative(root, file)} block ${index}`;
    let doc;
    try {
      doc = JSON.parse(m[1]);
    } catch {
      skipped++; // fragment or illustrative pseudo-JSON
      continue;
    }
    if (typeof doc !== "object" || doc === null || Array.isArray(doc) || !("coffeejson" in doc)) {
      skipped++; // valid JSON, but not a CoffeeJSON document
      continue;
    }
    validate(doc) ? ok(label) : fail(label, errorText());
  }
}

console.log("\nauthoring schema — generated, drift-free, and strict where the runtime is open");
const { renderAuthoringSchema, buildAuthoringSchema } = await import("./gen-authoring-schema.mjs");
const runtime = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
readFileSync(AUTHORING_SCHEMA_PATH, "utf8") === renderAuthoringSchema(runtime)
  ? ok("authoring schema matches its generator (no drift)")
  : fail("authoring schema matches its generator (no drift)", "regenerate: node tools/gen-authoring-schema.mjs");
const validateAuthoring = ajv.compile(buildAuthoringSchema(runtime));

// Fixtures that exist to prove RUNTIME leniency are exempt from the strict pass.
const authoringExempt = new Map([
  ["forward-compat-unknown-fields.json", "unknown members are its purpose"],
  ["newer-minor-version.json", "future-field probe is its purpose"],
  ["images-empty.json", "pins that empty = absent at runtime"],
  ["vendor-ext.json", "the reserved vendor home is an unknown member to the authoring lint"],
]);
for (const file of [...jsonFiles(join(root, "fixtures", "valid")), ...recipeFiles]) {
  const name = basename(file);
  if (authoringExempt.has(name)) {
    console.log(`  --  ${relative(root, file)} (exempt: ${authoringExempt.get(name)})`);
    continue;
  }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  validateAuthoring(doc)
    ? ok(`authoring ${relative(root, file)}`)
    : fail(`authoring ${relative(root, file)}`, (validateAuthoring.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("\n"));
}

// A typo'd optional field must fail authoring while passing the open runtime schema.
const typoProbe = {
  coffeejson: "1.0",
  recipes: [{ title: "x", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" }, watter_temp: { value: 93, unit: "celsius" } }],
};
validate(typoProbe)
  ? ok("typo probe accepted by the open runtime schema")
  : fail("typo probe accepted by the open runtime schema", errorText());
validateAuthoring(typoProbe)
  ? fail("typo probe rejected by the authoring schema", "validated, but watter_temp must be caught")
  : ok("typo probe rejected by the authoring schema");

// A localization carries wording, never data: a quantity smuggled into one states
// a different recipe under a language tag. The runtime schema stays open, because
// a later minor may add a text member.
const localizedDose = {
  coffeejson: "1.0",
  recipes: [{
    title: "4:6メソッド", lang: "ja",
    coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
    localizations: { en: { title: "4:6 Method", coffee: { value: 18, unit: "gram" } } },
  }],
};
validate(localizedDose)
  ? ok("a localization carrying a quantity stays valid at runtime (objects are open)")
  : fail("a localization carrying a quantity stays valid at runtime (objects are open)", errorText());
validateAuthoring(localizedDose)
  ? fail("authoring refuses a quantity inside a localization", "validated, but a per-locale dose is a different recipe")
  : ok("authoring refuses a quantity inside a localization");

// Adding a second bean silently unlinks every recipe in a working bag-to-brew
// document — legal at runtime, and almost always a producer mistake.
const recipe = (extra) => ({ title: "x", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" }, ...extra });
const bean = (id) => ({ id, name: id, roaster: { name: "Bench Roasters" } });
const unlinkedInMultiBean = { coffeejson: "1.0", beans: [bean("a"), bean("b")], recipes: [recipe({})] };
validate(unlinkedInMultiBean)
  ? ok("an unreferenced recipe in a multi-bean document stays valid at runtime")
  : fail("an unreferenced recipe in a multi-bean document stays valid at runtime", errorText());
validateAuthoring(unlinkedInMultiBean)
  ? fail("authoring flags an unreferenced recipe once a document carries several beans", "validated, but co-location no longer associates anything here")
  : ok("authoring flags an unreferenced recipe once a document carries several beans");

// The two shapes the rule must NOT touch: a referenced recipe in a multi-bean
// document, and the bag-to-brew case the whole format is built around.
const referencedInMultiBean = { coffeejson: "1.0", beans: [bean("a"), bean("b")], recipes: [recipe({ bean_ref: "a" })] };
validateAuthoring(referencedInMultiBean)
  ? ok("authoring accepts a referenced recipe in a multi-bean document")
  : fail("authoring accepts a referenced recipe in a multi-bean document", (validateAuthoring.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("\n"));
const bagToBrew = { coffeejson: "1.0", beans: [bean("a")], recipes: [recipe({})] };
validateAuthoring(bagToBrew)
  ? ok("authoring leaves bag-to-brew alone — one bean still associates by co-location")
  : fail("authoring leaves bag-to-brew alone — one bean still associates by co-location", (validateAuthoring.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("\n"));

console.log("\nschema ↔ prose parity — field tables and vocabularies agree with the schema");
const { parityFindings } = await import("./check-spec-parity.mjs");
const specDoc = (name) => readFileSync(join(root, "docs", "spec", name), "utf8");
const proseDocs = {
  envelope: specDoc("02-envelope.md"),
  recipe: specDoc("03-recipe.md"),
  bean: specDoc("04-bean.md"),
  tasting: specDoc("05-tasting.md"),
  vocabularies: specDoc("06-vocabularies.md"),
};
for (const { label, error } of parityFindings(runtime, proseDocs)) {
  error ? fail(`parity ${label}`, error) : ok(`parity ${label}`);
}

// The parity layer must itself be proven to bite: without seeded drifts, a green
// run proves nothing.
const probes = [
  ["a schema field the prose lacks is caught", (s) => { s.$defs.recipe.properties.ghost_field = { type: "string" }; },
    null, (f) => f.label === "fields recipe" && f.error?.includes("ghost_field")],
  ["a schema enum value the prose still lists is caught", (s) => { s.$defs.method.enum = s.$defs.method.enum.filter((v) => v !== "moka"); },
    null, (f) => f.label === "vocab `method`" && f.error?.includes("moka")],
  ["a renamed prose section fails loudly", null,
    (d) => ({ ...d, recipe: d.recipe.replace("## Gear object", "## Gear thing") }),
    (f) => f.label === "fields gear" && f.error?.includes("not found")],
  ["a schema field the tasting prose lacks is caught", (s) => { s.$defs.tasting.properties.ghost_field = { type: "string" }; },
    null, (f) => f.label === "fields tasting" && f.error?.includes("ghost_field")],
  ["a perceived dimension the prose lacks is caught", (s) => { s.$defs.tasting.properties.perceived.properties.body = { type: "number" }; },
    null, (f) => f.label === "fields perceived" && f.error?.includes("body")],
  ["a requiredness disagreement is caught", (s) => { s.$defs.party.required = []; },
    null, (f) => f.label === "required party.name" && f.error],
  ["a Type-cell disagreement is caught", null,
    (d) => ({ ...d, bean: d.bean.replace("| `process` | array of string (enum) |", "| `process` | string (enum) |") }),
    (f) => f.label === "type bean.process" && f.error?.includes("schema says array")],
];
for (const [label, mutateSchema, mutateDocs, hit] of probes) {
  const schemaCopy = structuredClone(runtime);
  mutateSchema?.(schemaCopy);
  const docsCopy = mutateDocs ? mutateDocs(proseDocs) : proseDocs;
  parityFindings(schemaCopy, docsCopy).some(hit)
    ? ok(`parity probe: ${label}`)
    : fail(`parity probe: ${label}`, "seeded drift produced no finding");
}

console.log("\nschema coverage — the reference implementation names every wire key");
const { coverageFindings } = await import("./check-schema-coverage.mjs");
const coreTypes = readFileSync(join(root, "packages", "core", "src", "types.ts"), "utf8");
for (const { label, error } of coverageFindings(runtime, { ts: coreTypes }))
  error ? fail(`coverage ${label}`, error) : ok(`coverage ${label}`);

// Decoding skips an undeclared key in silence, so no other test here can fail on
// one — which makes these probes load-bearing rather than ceremonial.
const ghosted = structuredClone(runtime);
ghosted.$defs.tasting.properties.ghost_key = { type: "string" };
coverageFindings(ghosted, { ts: coreTypes }).some((f) => f.error?.includes("tasting.ghost_key"))
  ? ok("coverage probe: a schema key no type names is caught")
  : fail("coverage probe: a schema key no type names is caught", "seeded key produced no finding");
const orphaned = structuredClone(runtime);
orphaned.$defs.ghost_object = { type: "object", properties: { a: { type: "string" } } };
coverageFindings(orphaned, { ts: coreTypes }).some((f) => f.error?.includes("ghost_object.a"))
  ? ok("coverage probe: a new $def nobody mapped is reported, not skipped")
  : fail("coverage probe: a new $def nobody mapped is reported, not skipped", "seeded $def produced no finding");
// A key must be named on ITS OWN type, not merely appear somewhere in the file.
coverageFindings(runtime, { ts: coreTypes.replace(/export interface Bean\b/, "export interface NotBean") })
  .some((f) => f.error?.includes("bean.name"))
  ? ok("coverage probe: a key named only on some other type does not count as read")
  : fail("coverage probe: a key named only on some other type does not count as read", "seeded rename produced no finding");

console.log("\ndocumentation links — every relative link and #anchor resolves");
const { linkFindings, anchorsOf, servedRepoPath } = await import("./check-doc-links.mjs");
const linkedMd = new Map(
  [join(root, "README.md"), join(root, "CONTRIBUTING.md"), join(root, "CHANGELOG.md"),
   join(root, "fixtures", "README.md"),
   // The package READMEs are link targets from docs/, so their anchors are part
   // of the graph the docs rely on.
   join(root, "packages", "core", "README.md"), join(root, "packages", "react", "README.md"),
   ...mdFiles(join(root, "docs")).sort()]
    .map((f) => [relative(root, f).split(sep).join("/"), readFileSync(f, "utf8")]),
);
const linkProblems = linkFindings(linkedMd, (rel) => existsSync(join(root, ...rel.split("/"))));
for (const { label, error } of linkProblems) fail(`links ${label}`, error);
linkProblems.length === 0
  ? ok(`links — ${linkedMd.size} documents, every relative target and anchor resolves`)
  : null;

// Proven to bite, and proven not to bite on the shape that looks broken and is not.
const seededDead = new Map([["a.md", "[x](b.md#nope)"], ["b.md", "# Real heading"]]);
linkFindings(seededDead).some((f) => f.error === "no heading with that anchor")
  ? ok("links probe: a dead anchor is caught")
  : fail("links probe: a dead anchor is caught", "seeded dead anchor produced no finding");
linkFindings(new Map([["a.md", "[x](gone.md)"]])).some((f) => f.error === "unknown target")
  ? ok("links probe: a missing target is caught")
  : fail("links probe: a missing target is caught", "seeded missing file produced no finding");
// The package READMEs link the canonical host, because npm renders them beside a
// package that ships no `docs/`. Those links are checked like any other.
linkFindings(new Map([["a.md", "[x](https://coffeejson.org/docs/gone.md)"]]))
  .some((f) => f.error === "unknown target")
  ? ok("links probe: a dead canonical-host target is caught")
  : fail("links probe: a dead canonical-host target is caught", "seeded missing served file produced no finding");
servedRepoPath("https://example.com/docs/spec/01-overview.md") === null
  ? ok("links probe: another host's path is not read as this repo's")
  : fail("links probe: another host's path is not read as this repo's", "prefix match too loose");
// GitHub does not collapse runs of spaces when it slugs a heading, so
// `### Espresso (dose : yield)` really does anchor at `espresso-dose--yield`.
anchorsOf("### Espresso (dose : yield)").has("espresso-dose--yield")
  ? ok("links probe: a double-hyphen anchor is not 'tidied' into a false failure")
  : fail("links probe: a double-hyphen anchor is not 'tidied' into a false failure", "slug rule diverged from GitHub's");

console.log("\nregistries — data consistency, prose seeds, and the repo's own documents");
const { registryFindings } = await import("./check-registries.mjs");
const gearRegistry = JSON.parse(readFileSync(join(root, "registries", "gear.json"), "utf8"));
const varietalRegistry = JSON.parse(readFileSync(join(root, "registries", "varietals.json"), "utf8"));
// The registries that are a prose list as data — checked token for token against
// the chapter that recommends them.
const TOKEN_REGISTRIES = [
  { file: "addition-types.json", key: "addition_types", section: "Addition type" },
  { file: "producer-roles.json", key: "producer_roles", section: "Producer role" },
].map((r) => ({ ...r, data: JSON.parse(readFileSync(join(root, "registries", r.file), "utf8")) }));
const registryDocs = [...jsonFiles(join(root, "fixtures", "valid")), ...recipeFiles]
  .map((f) => ({ label: relative(root, f), doc: JSON.parse(readFileSync(f, "utf8")) }));
for (const { label, error } of registryFindings(gearRegistry, varietalRegistry, proseDocs.vocabularies, registryDocs, TOKEN_REGISTRIES))
  error ? fail(`registry ${label}`, error) : ok(`registry ${label}`);

const customEntry = { gear: [...gearRegistry.gear, { id: "custom", category: "dripper", label: "x" }] };
registryFindings(customEntry, varietalRegistry, proseDocs.vocabularies, []).some((f) => f.label === "gear custom" && f.error)
  ? ok("registry probe: a custom registry entry is rejected")
  : fail("registry probe: a custom registry entry is rejected", "seeded entry produced no finding");
// Injected into the seed table itself — the file's earlier bare `hario-v60`
// mentions are outside the section the extractor reads.
const ghostProse = proseDocs.vocabularies.replace("`hario-v60` · `chemex`", "`hario-v60` · `ghost-brewer` · `chemex`");
registryFindings(gearRegistry, varietalRegistry, ghostProse, []).some((f) => f.label === "prose gear seeds" && f.error?.includes("ghost-brewer"))
  ? ok("registry probe: a prose slug missing from the data is caught")
  : fail("registry probe: a prose slug missing from the data is caught", "seeded slug produced no finding");
const probeDoc = (id) => ({ coffeejson: "1.0", recipes: [{ title: "x", coffee: { value: 1, unit: "gram" }, water: { value: 1, unit: "gram" }, brewer: { id } }] });
registryFindings(gearRegistry, varietalRegistry, proseDocs.vocabularies, [{ label: "probe", doc: probeDoc("not-registered") }]).some((f) => f.label === "document gear probe" && f.error?.includes("not-registered"))
  ? ok("registry probe: an unregistered document gear id is caught")
  : fail("registry probe: an unregistered document gear id is caught", "seeded id produced no finding");
// An alias is a synonym this repository's own documents never write.
registryFindings(gearRegistry, varietalRegistry, proseDocs.vocabularies, [{ label: "probe", doc: probeDoc("sage-bambino") }]).some((f) => f.label === "document gear probe" && f.error?.includes("sage-bambino"))
  ? ok("registry probe: an alias id in one of the repo's documents is caught")
  : fail("registry probe: an alias id in one of the repo's documents is caught", "seeded alias produced no finding");
const driftedTokens = TOKEN_REGISTRIES.map((r, i) =>
  i === 0 ? { ...r, data: { ...r.data, [r.key]: [...r.data[r.key], "ghost-token"] } } : r);
registryFindings(gearRegistry, varietalRegistry, proseDocs.vocabularies, [], driftedTokens)
  .some((f) => f.label === "registry parity addition-types.json" && f.error?.includes("ghost-token"))
  ? ok("registry probe: a token the prose does not recommend is caught")
  : fail("registry probe: a token the prose does not recommend is caught", "seeded token produced no finding");

console.log("\nfixtures/README.md — the tables and the directories describe each other");
const { catalogFindings } = await import("./check-fixture-catalog.mjs");
const fixtureNames = (dir) => jsonFiles(join(root, "fixtures", dir)).map((f) => basename(f));
const fixturesReadme = readFileSync(join(root, "fixtures", "README.md"), "utf8");
const fixtureDirs = { valid: fixtureNames("valid"), invalid: fixtureNames("invalid") };
for (const { label, error } of catalogFindings(fixturesReadme, fixtureDirs))
  error ? fail(`catalog ${label}`, error) : ok(`catalog ${label}`);

catalogFindings(fixturesReadme, { ...fixtureDirs, invalid: [...fixtureDirs.invalid, "ghost-fixture.json"] })
  .some((f) => f.label === "invalid/ table" && f.error?.includes("ghost-fixture.json"))
  ? ok("catalog probe: a fixture with no table row is caught")
  : fail("catalog probe: a fixture with no table row is caught", "seeded file produced no finding");
catalogFindings(fixturesReadme.replace("| `minimal.json` |", "| `renamed-away.json` |"), fixtureDirs)
  .some((f) => f.label === "valid/ table" && f.error?.includes("minimal.json"))
  ? ok("catalog probe: a table row naming no file is caught")
  : fail("catalog probe: a table row naming no file is caught", "seeded row produced no finding");

console.log("\ntransport scan vectors — the § Accepting-links-from-any-host contract, executed");
// transport.md § Encoding, kept literal: parse URL → require http(s) → read d →
// enforce the base64url alphabet (Node's decoder silently skips illegal
// characters) → re-pad, decode → dispatch on the first byte → cap at 8192 bytes,
// bounding the inflate → strict UTF-8 → JSON.parse → envelope.
const decodeShareUrl = (input) => {
  let url;
  try {
    url = new URL(input);
  } catch {
    return { rejected: "not a URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { rejected: "not an http(s) URL" };
  const d = url.searchParams.get("d");
  if (d === null) return { rejected: "no d parameter" };
  if (d === "") return { rejected: "empty d parameter" };
  if (!/^[A-Za-z0-9_-]+=*$/.test(d)) return { rejected: "characters outside the base64url alphabet" };
  const b64 = d.replace(/=+$/, "").replaceAll("-", "+").replaceAll("_", "/");
  const bytes = Buffer.from(b64 + "=".repeat((4 - (b64.length % 4)) % 4), "base64");
  // The encoding discriminator (transport.md § Compression): one byte, decided
  // once, never retried. A JSON document begins '{' (0x7B); a zlib stream carries
  // CM 8 in the low nibble and passes the modulo-31 header check, where testing
  // 0x78 exactly would reject a legal small-window producer.
  const zlibHeader =
    bytes.length > 1 && (bytes[0] & 0x0f) === 8 && ((bytes[0] << 8) | bytes[1]) % 31 === 0 && !(bytes[1] & 0x20);
  let payload;
  if (bytes.length > 0 && bytes[0] === 0x7b) {
    if (bytes.length > 8192) return { rejected: "decoded payload exceeds the 8192-byte cap" };
    payload = bytes;
  } else if (zlibHeader) {
    // Base64 length no longer bounds the document: a kilobyte can inflate to
    // megabytes, so stop at the cap and reject.
    try {
      payload = inflateSync(bytes, { maxOutputLength: 8192 });
    } catch (e) {
      return {
        rejected:
          e.code === "ERR_BUFFER_TOO_LARGE"
            ? "payload inflates past the 8192-byte cap"
            : "compressed payload is damaged — not a well-formed zlib stream",
      };
    }
  } else {
    return { rejected: "decoded payload begins neither '{' nor a zlib header — unrecognized encoding" };
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    return { rejected: "payload bytes are not valid UTF-8" };
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { rejected: "payload decodes but is not JSON" };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc) || typeof doc.coffeejson !== "string")
    return { rejected: "JSON object without a coffeejson member" };
  // docs/spec/07-versioning.md § The version gate: the major component alone, and
  // before the envelope check — a major nobody reads is not a major whose
  // collections are ours to judge. The grammar is MAJOR.MINOR, no patch component
  // and no leading zero on the major, so a spelling outside it names no major.
  const major = /^(0|[1-9][0-9]*)\.[0-9]+$/.exec(doc.coffeejson)?.[1];
  if (major === undefined || Number(major) !== 1)
    return { rejected: "a coffeejson major version this consumer does not support" };
  // docs/spec/02-envelope.md: absent and empty state the same thing, so one test
  // covers both, and a non-array reads as absent.
  const carries = (key) => Array.isArray(doc[key]) && doc[key].length > 0;
  if (!carries("beans") && !carries("recipes"))
    return { rejected: "neither a non-empty beans nor a non-empty recipes collection" };
  return { document: doc };
};

// `@coffeejson/core` ships this algorithm as `decodeScanned`; the reader above is
// an INDEPENDENT implementation of the same prose, deliberately kept so the
// vectors prove the spec is implementable rather than that the package agrees with
// itself. A disagreement means prose and shipped code have diverged.
const { DECODE_ERROR_KINDS, decodeScanned } = await import("../packages/core/dist/index.js");
const packageOutcome = (input) => {
  const r = decodeScanned(input);
  return r.ok ? { document: r.document } : { rejectedKind: r.error.kind };
};

const { vectors } = JSON.parse(readFileSync(join(root, "fixtures", "transport", "scan-vectors.json"), "utf8"));
for (const vector of vectors) {
  const outcome = decodeShareUrl(vector.input);
  const pkg = packageOutcome(vector.input);
  if (vector.expect === "document") {
    JSON.stringify(pkg.document) === JSON.stringify(vector.document)
      ? ok(`scan ${vector.name} — @coffeejson/core agrees`)
      : fail(`scan ${vector.name} — @coffeejson/core agrees`,
             pkg.document ? "decoded a different document" : `rejected as "${pkg.rejectedKind}"`);
  } else {
    // The vector's own `kind` is the contract. A vector naming a kind the
    // package does not vend would otherwise pass by agreeing with nothing.
    DECODE_ERROR_KINDS.includes(vector.kind)
      ? ok(`scan ${vector.name} names a vended error kind`)
      : fail(`scan ${vector.name} names a vended error kind`,
             vector.kind === undefined ? "the vector states no kind" : `no such kind: "${vector.kind}"`);
    pkg.rejectedKind === vector.kind
      ? ok(`scan ${vector.name} — @coffeejson/core rejects for the same reason`)
      : fail(`scan ${vector.name} — @coffeejson/core rejects for the same reason`,
             `package said "${pkg.rejectedKind}", the vector states "${vector.kind}"`);
  }
  if (vector.expect === "document") {
    if (!outcome.document) {
      fail(`scan ${vector.name}`, `rejected (${outcome.rejected}), but this vector must decode`);
      continue;
    }
    JSON.stringify(outcome.document) === JSON.stringify(vector.document)
      ? ok(`scan ${vector.name}`)
      : fail(`scan ${vector.name}`, "decoded, but the document differs from the vector's expectation");
    validate(outcome.document)
      ? ok(`scan ${vector.name} document validates`)
      : fail(`scan ${vector.name} document validates`, errorText());
  } else if (!outcome.rejected) {
    fail(`scan ${vector.name}`, "decoded, but this vector must be rejected");
  } else {
    // A vector rejecting for the wrong reason is an implementation passing by
    // accident.
    outcome.rejected === vector.reason
      ? ok(`scan ${vector.name} rejected — ${outcome.rejected}`)
      : fail(`scan ${vector.name}`, `rejected as "${outcome.rejected}", but the vector states "${vector.reason}"`);
  }
}

console.log("\ntransport file binding — a byte-order mark is the consumer's to discard");
// transport.md § File: a producer must not write one, and a consumer that meets
// one reads past it rather than rejecting the document. The fixture carries the
// real bytes, so the mark itself is asserted first — a fixture that quietly lost
// it would keep passing the parse below while testing nothing.
const bomBytes = readFileSync(join(root, "fixtures", "transport", "bom-prefixed-file.json"));
const mark = [0xef, 0xbb, 0xbf];
mark.every((b, i) => bomBytes[i] === b)
  ? ok("bom-prefixed-file.json still begins with a byte-order mark")
  : fail("bom-prefixed-file.json still begins with a byte-order mark",
         `first bytes are ${[...bomBytes.subarray(0, 3)].map((b) => b.toString(16)).join(" ")}`);

let bomDoc;
try {
  bomDoc = JSON.parse(bomBytes.toString("utf8").replace(/^\uFEFF/, ""));
} catch (err) {
  bomDoc = null;
  fail("the mark discarded, the file parses", err.message);
}
if (bomDoc) {
  ok("the mark discarded, the file parses");
  validate(bomDoc)
    ? ok("the mark discarded, the document validates")
    : fail("the mark discarded, the document validates", errorText());
}

console.log(`\n${checked} checks, ${failures} failure(s), ${skipped} non-document block(s) skipped`);
process.exit(failures ? 1 : 0);
