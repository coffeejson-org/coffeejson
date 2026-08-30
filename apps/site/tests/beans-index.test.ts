import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { expect, test } from "vitest";
import { buildBeansIndex, buildIndex } from "../tools/gen.mjs";
import type { BeanEntry } from "../src/lib/filter";

const REPO = fileURLToPath(new URL("../../..", import.meta.url));
const RECIPES = join(REPO, "recipes");

const beans = buildBeansIndex() as BeanEntry[];
const bean = (key: string): BeanEntry => {
  const b = beans.find((x) => x.key === key);
  if (!b) throw new Error(`no bean entry ${key} (have: ${beans.map((x) => x.key).join(", ")})`);
  return b;
};

test("one card per roaster+bean key — Monarch's documents collapse to one", () => {
  // One coffee, two publications: Onyx's own product page states it with two
  // brew methods in one document, and the Fellow profile is a separate
  // publication of the same coffee. Separate documents, one card — so this bean
  // gathers its recipes from more than one document.
  expect(beans.filter((b) => b.name === "Monarch")).toHaveLength(1);
  expect(bean("onyx-coffee-lab/monarch").recipes.map((r) => r.slug)).toEqual([
    "onyx-monarch",
    "onyx-monarch",
    "onyx-monarch-fellow-series-1",
  ]);
});

test("a bag named in a non-Latin script keeps its own key", () => {
  // The key is `roaster/name`, so an empty slug on either half silently merges
  // distinct bags onto one key — no warning, and no other gate catches it. A
  // name written only in a non-Latin script must survive slugify for both
  // halves to stay distinct.
  for (const b of beans) {
    const [roasterSlug, nameSlug] = b.key.split("/");
    expect(roasterSlug, `empty roaster slug for ${b.roaster.name}`).not.toBe("");
    expect(nameSlug, `empty name slug for ${b.name}`).not.toBe("");
  }
  expect(bean("サザコーヒー/ゴールデンモカ").name).toBe("ゴールデンモカ");
  expect(bean("onibus-coffee/ケニア-ガトンボヤ").roaster.name).toBe("ONIBUS COFFEE");
});

test("every corpus bean reaches the index — no two bags share a key", () => {
  // The dedupe is by design (the three Monarch documents are one bag), so a
  // collision cannot be distinguished from an intended merge by counting alone.
  // Assert instead that distinct roaster+name pairs stay distinct.
  const pairs = new Set<string>();
  // NUL joins the halves: the one byte a name cannot contain, so no two pairs collide.
  for (const f of readdirSync(RECIPES).filter((n) => n.endsWith(".json") && n !== "catalog.json")) {
    const doc = JSON.parse(readFileSync(join(RECIPES, f), "utf8"));
    for (const b of doc.beans ?? []) if (b.roaster?.name && b.name) pairs.add(`${b.roaster.name}\u0000${b.name}`);
  }
  expect(beans).toHaveLength(pairs.size);
  expect(new Set(beans.map((b) => b.key)).size).toBe(beans.length);
});

test("facts render from the richest instance, never merged across documents", () => {
  // The Fellow Series 1 transcription carries a slim Monarch (no product URL, no
  // process, no roast level, bare origin); Onyx's own product page carries the
  // full one. The full one must win outright — and no field may be back-filled
  // from the loser, which is what would make the card describe a bag no single
  // source ever published.
  const m = bean("onyx-coffee-lab/monarch");
  expect(m.url).toBe("https://onyxcoffeelab.com/products/monarch");
  expect(m.process).toBe("Washed");
  expect(m.roast).toBe("Dark");
  expect(m.origin).toBe(
    "The Queen · Colombia · 1800 m · Harvest Rotating Microlots"
    + " + Alaka G1 Natural · Ethiopia · 1800 m · Natural · Harvest Rotating Microlots");
});

test("a blend distinguished only by per-item process still reads as two coffees", () => {
  expect(bean("onyx-coffee-lab/tropical-weather").origin)
    .toBe("Ethiopia · 1900 m · Washed · Harvest Rotating Microlots · 50%"
      + " + Ethiopia · 1900 m · Natural · Harvest Rotating Microlots · 50%");
});

// The origin line is `BeanCard`'s, fact for fact and separator for separator, so
// a bag reads the same on a static page as it does in a consumer's card.
test("an origin item shows its producers, their roles, and its altitude", () => {
  expect(bean("linea-caffe/ethiopia-suke-espresso").origin)
    .toBe("Oromia, Ethiopia · Tesfaye Bekele (Producer), Suke Quto Coffee Farms (Cooperative) · 1800–2200 m");
});

test("documents carrying no beans contribute nothing", () => {
  // Bean-less recipe documents come in two flavors and both must stay out of
  // the bean lens: a creator's technique (Kasuya, Hoffmann — no bag at all) and
  // a roaster's own brew guide, which names a publisher but no coffee (April's
  // per-line base recipes, Sightglass's V60 guide). Derived from the corpus
  // rather than counted, so a new one of either kind cannot silently pass.
  const beanless = new Set(readdirSync(RECIPES)
    .filter((f) => f.endsWith(".json") && f !== "catalog.json")
    .filter((f) => !(JSON.parse(readFileSync(join(RECIPES, f), "utf8")).beans ?? []).length)
    .map((f) => f.replace(/\.json$/, "")));
  expect(beanless.size).toBeGreaterThan(0);

  const linked = new Set(beans.flatMap((b) => b.recipes.map((r) => r.slug)));
  for (const slug of beanless) expect(linked.has(slug), slug).toBe(false);
  // Documents, not cards: the recipe index emits one entry per recipe, and a
  // roaster product page states several. Every document that carries both a
  // bean and a recipe links; nothing else does.
  const carded = new Set(buildIndex().map((e) => e.slug));
  expect(linked).toEqual(new Set([...carded].filter((s) => !beanless.has(s))));
});

test("every card names and links a roaster — the attribution the lens promises", () => {
  for (const b of beans) {
    expect(b.roaster.name.length, b.key).toBeGreaterThan(0);
    expect(b.url ?? b.roaster.url, b.key).toMatch(/^https?:\/\//);
    expect(b.name.length, b.key).toBeGreaterThan(0);
  }
});

// The entry is the projection's party trimmed to what a card renders, so a
// `role` or a `type` in the served index is a wire read that got back in.
test("a card's roaster is the projected name and link, and nothing more", () => {
  for (const b of beans)
    expect(Object.keys(b.roaster).sort(), b.key).toEqual(b.roaster.url ? ["name", "url"] : ["name"]);
  expect(beans.some((b) => b.roaster.url)).toBe(true);
});

test("each card's payload is the winning bean re-enveloped VERBATIM", () => {
  // The card shares a real document, not a synthesis. Every byte of its bean must
  // equal a bean some transcription actually carries — if this ever drifts, the
  // page would be publishing a bag no source ever described.
  const corpusBeans = readdirSync(RECIPES)
    .filter((f) => f.endsWith(".json") && f !== "catalog.json")
    .flatMap((f) => JSON.parse(readFileSync(join(RECIPES, f), "utf8")).beans ?? [])
    .map((b: unknown) => JSON.stringify(b));

  for (const b of beans) {
    const doc = JSON.parse(Buffer.from(b.payload, "base64url").toString("utf8"));
    expect(Object.keys(doc), b.key).toEqual(["coffeejson", "beans"]);
    expect(doc.beans, b.key).toHaveLength(1);
    expect(corpusBeans, b.key).toContain(JSON.stringify(doc.beans[0]));
    expect(doc.beans[0].name, b.key).toBe(b.name);
  }
});

test("every bean payload validates as a CoffeeJSON document", () => {
  const validate = new Ajv2020({ allErrors: true });
  addFormats(validate);
  const check = validate.compile(JSON.parse(
    readFileSync(join(REPO, "docs/schema/coffeejson-1.0.schema.json"), "utf8")));
  for (const b of beans) {
    const doc = JSON.parse(Buffer.from(b.payload, "base64url").toString("utf8"));
    expect(check(doc), `${b.key}: ${JSON.stringify(check.errors)}`).toBe(true);
  }
});

// Beans whose own prose puts them past the QR ceiling. A bean card prints a
// self-contained ?d= QR, so over-budget means NO working QR (it degrades to Copy
// link); attributed roaster prose outranks link length, so the document keeps
// its words. A named list rather than a raised ceiling keeps the trade counted:
// a list that starts growing means the ceiling, not the prose, is the problem.
const OVER_QR_BUDGET = new Set([
  "drink-coffee-do-stuff/roaster-s-reserve-ethiopia-yirgacheffe-banko-chelchele-supernatural",
  "dak-coffee-roasters/orange-county-costa-rica",
]);

test("bean payloads stay inside the QR budget, or are on the counted list", () => {
  for (const b of beans) {
    const length = `https://coffeejson.org/r/?d=${b.payload}`.length;
    if (OVER_QR_BUDGET.has(b.key)) {
      expect(length, `${b.key} is listed as over budget but now fits — remove it`)
        .toBeGreaterThanOrEqual(2500);
    } else {
      expect(length, b.key).toBeLessThan(2500);
    }
  }
});

// ── The rules the shipped corpus cannot yet exercise ──────────
// Tie-breaks and bean_ref routing need documents the corpus does not have, so
// they are driven through the injectable corpus rather than left untested until
// a future transcription happens to hit them.

const ROASTER = { name: "Bench Roasters", url: "https://example.test" };
const doc = (slug: string, transcribed: string, beansArr: unknown[], recipesArr: unknown[] = []) =>
  ({ entry: { slug, attribution: { source_label: slug, transcribed } },
     doc: { beans: beansArr, recipes: recipesArr } });

test("equal richness breaks to the newer transcription, then to catalog order", () => {
  const bag = (roast: string) => ({ name: "Tie", roaster: ROASTER, roast_level: roast });
  // Same field count in all three; the 2026-02-01 document is the newest.
  const [byDate] = buildBeansIndex([
    doc("older", "2026-01-01", [bag("light")]),
    doc("newer", "2026-02-01", [bag("dark")]),
  ]);
  expect(byDate!.roast).toBe("Dark");

  // Same field count AND same date — catalog order decides, first wins.
  const [byOrder] = buildBeansIndex([
    doc("first", "2026-01-01", [bag("light")]),
    doc("second", "2026-01-01", [bag("dark")]),
  ]);
  expect(byOrder!.roast).toBe("Light");
});

test("richness beats recency — a fuller older transcription still wins", () => {
  const [entry] = buildBeansIndex([
    doc("full", "2026-01-01", [{ name: "Tie", roaster: ROASTER, roast_level: "light", process: ["washed"] }]),
    doc("slim", "2026-09-09", [{ name: "Tie", roaster: ROASTER, roast_level: "dark" }]),
  ]);
  expect(entry!.roast).toBe("Light");
  expect(entry!.process).toBe("Washed");
});

test("bean_ref routes a recipe to the one bag it names", () => {
  const [alpha, beta] = buildBeansIndex([doc("multi", "2026-01-01",
    [{ id: "a", name: "Alpha", roaster: ROASTER }, { id: "b", name: "Beta", roaster: ROASTER }],
    [{ title: "For Beta", method: "espresso", bean_ref: "b" }])]);
  expect(alpha!.recipes).toEqual([]);
  expect(beta!.recipes).toEqual([{ slug: "multi", title: "For Beta", methodLabel: "Espresso" }]);
});

test("with no bean_ref a recipe lists under every bag its document carries", () => {
  const entries = buildBeansIndex([doc("multi", "2026-01-01",
    [{ name: "Alpha", roaster: ROASTER }, { name: "Beta", roaster: ROASTER }],
    [{ title: "House brew", method: "pour_over" }])]);
  for (const e of entries) expect(e.recipes.map((r) => r.title)).toEqual(["House brew"]);
});

test("an unresolved bean_ref leaves the recipe unlinked, per the spec", () => {
  // 03-recipe: an unresolved reference leaves the recipe unlinked and consumers
  // must not fail. Guessing a bag here would file a recipe under a card its
  // source never associated it with.
  const [entry] = buildBeansIndex([doc("multi", "2026-01-01",
    [{ id: "a", name: "Alpha", roaster: ROASTER }],
    [{ title: "Dangling", method: "espresso", bean_ref: "nope" }])]);
  expect(entry!.recipes).toEqual([]);
});

test("a document carrying several recipes yields a card for each, not just the first", () => {
  // A roaster product page publishing one bag with three brew methods is one
  // publication stating three recipes: a card per recipe, never per document.
  // The projection must not decide how many recipes a source may state.
  // Injected rather than corpus-read, so the guard holds whatever the corpus
  // happens to carry.
  const bean = { name: "Sample", roaster: { name: "Bench Roasters" } };
  const recipe = (title: string, method: string) => ({
    title, method, author: { name: "Bench Roasters", type: "organization" },
    based_on: "https://example.test/products/sample",
    coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  });
  const entries = buildIndex([{
    entry: { slug: "sample", attribution: { source_label: "Bench", transcribed: "2026-07-24" } },
    doc: { coffeejson: "1.0", beans: [bean],
      recipes: [recipe("Dwell", "pour_over"), recipe("Chemex", "pour_over"), recipe("French Press", "french_press")] },
  }]);
  expect(entries.map((e) => e.title)).toEqual(["Dwell", "Chemex", "French Press"]);
  // Every card keeps the document's slug (the ?s= target and download name)
  // while carrying its own id, and each says how many it is one of.
  expect(entries.map((e) => e.slug)).toEqual(["sample", "sample", "sample"]);
  expect(entries.map((e) => e.id)).toEqual(["sample#1", "sample#2", "sample#3"]);
  expect(entries.every((e) => e.siblings === 3)).toBe(true);
  // Each card carries ITS OWN document, not the publication: three cards
  // sharing one payload would hand a reader who wanted the French press two
  // brews they never asked for.
  expect(new Set(entries.map((e) => e.payload)).size).toBe(3);
  for (const [i, e] of entries.entries()) {
    const doc = JSON.parse(Buffer.from(e.payload, "base64url").toString("utf8"));
    expect(doc.recipes, e.id).toHaveLength(1);
    expect(doc.recipes[0].title, e.id).toBe(entries[i]!.title);
    // The bag travels with each of them: one co-located bean is the association.
    expect(doc.beans, e.id).toHaveLength(1);
    expect(doc.beans[0].name, e.id).toBe("Sample");
  }
});

test("a lone recipe's card id stays the bare slug — shipped ids do not move", () => {
  // The suffix is what distinguishes siblings, so it must appear ONLY where a
  // document genuinely carries several recipes. Every single-recipe document —
  // which is every document whose id has already shipped — keeps a bare slug.
  const index = buildIndex();
  const perSlug = new Map<string, number>();
  for (const e of index) perSlug.set(e.slug, (perSlug.get(e.slug) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const e of index) {
    const n = (seen.get(e.slug) ?? 0) + 1;
    seen.set(e.slug, n);
    const count = perSlug.get(e.slug)!;
    expect(e.siblings, e.slug).toBe(count);
    expect(e.id, e.slug).toBe(count > 1 ? `${e.slug}#${n}` : e.slug);
  }
  expect(new Set(index.map((e) => e.id)).size).toBe(index.length);
});

test("a bean with no name or no roaster name contributes no card", () => {
  expect(buildBeansIndex([doc("x", "2026-01-01",
    [{ name: "Nameless roaster", roaster: {} }, { roaster: ROASTER }])])).toEqual([]);
});
