import { expect, test } from "vitest";
import { buildIndex } from "../tools/gen.mjs";
import { decodePayload, normalize, timerState } from "@coffeejson/core";
import { docJsonLd } from "../src/lib/jsonld";

const index = buildIndex(); // throws/exits on invalid corpus — that IS the test

test("every corpus entry round-trips encode→decode byte-identically", () => {
  for (const e of index) {
    const r = decodePayload(e.payload);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.stringify(r.document)).toBe(Buffer.from(e.payload, "base64url").toString("utf8"));
  }
});
test("every corpus recipe renders", () => {
  for (const e of index) {
    const r = decodePayload(e.payload);
    if (r.ok) expect(normalize(r.document).recipes[0]!.title).toEqual(expect.any(String));
  }
});
test("every corpus recipe with steps produces a sane timer schedule", () => {
  for (const e of index.filter((e) => e.stepCount > 0)) {
    const r = decodePayload(e.payload);
    if (!r.ok) continue;
    const { steps, finishS } = normalize(r.document).recipes[0]!;
    const start = timerState(steps, finishS, 0, new Set());
    expect(start.finished).toBe(false);
    const end = timerState(steps, finishS, 100_000, new Set(steps.map((_, i) => i)));
    expect(end.finished).toBe(true);
  }
});
// The `url` option is exercised with a synthetic address on purpose. Asserting
// the `?d=` share link there would bless the shape robots.txt disallows. No page
// passes a url today; the option exists for the day a recipe has a page of its
// own to name.
const SYNTHETIC_PAGE = "https://example.test/a-page";

test("every corpus entry exports JSON-LD carrying its author and source", () => {
  for (const e of index) {
    const r = decodePayload(e.payload);
    expect(r.ok).toBe(true);
    if (!r.ok) continue;
    const [ld] = docJsonLd(r.document, SYNTHETIC_PAGE) as Record<string, unknown>[];
    expect(ld, e.slug).toBeDefined();
    expect((ld!["author"] as { name?: string })?.name, e.slug).toBe(e.author.name);
    expect(ld!["isBasedOn"], e.slug).toBe(e.attribution.source_url);
    expect(ld!["url"], e.slug).toBe(SYNTHETIC_PAGE);
  }
});

test("omitting the url option leaves no url member to contradict a canonical", () => {
  const r = decodePayload(index[0]!.payload);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const [ld] = docJsonLd(r.document) as Record<string, unknown>[];
  expect(ld).toBeDefined();
  expect(ld!["url"]).toBeUndefined();
});

// A bean beside a recipe rides inside the Recipe node; a bean on its own — a
// roaster's bag, scanned to /r — is the page's subject and exports as Product.
test("a bean-only document exports Product; a bag-to-brew document exports only its Recipe", () => {
  const bag = { coffeejson: "1.0", beans: [{ name: "Monarch", roaster: { name: "Onyx Coffee Lab" } }] };
  const [bean] = docJsonLd(bag as never) as Record<string, unknown>[];
  expect(bean).toMatchObject({ "@type": "Product", name: "Monarch" });
  expect(bean).not.toHaveProperty("offers");
  const brew = { ...bag, recipes: [{ title: "Shot", coffee: { value: 18, unit: "gram" } }] };
  const nodes = docJsonLd(brew as never) as Record<string, unknown>[];
  expect(nodes.map((n) => n["@type"])).toEqual(["Recipe"]);
});

// An untitled recipe still says what the page is about, so the bean fallback
// must read whether a recipe is PRESENT, not whether one managed to export.
test("a document whose only recipe is untitled exports nothing — not the bag beside it", () => {
  const doc = {
    coffeejson: "1.0",
    beans: [{ name: "Monarch", roaster: { name: "Onyx Coffee Lab" } }],
    recipes: [{ coffee: { value: 18, unit: "gram" } }],
  };
  expect(docJsonLd(doc as never)).toEqual([]);
});

// One page, one subject: a URL handed to several Product nodes would have each
// of them claim it, and two entities cannot share one address.
test("a multi-bean document exports every bag but hands none of them the page url", () => {
  const doc = {
    coffeejson: "1.0",
    beans: [
      { name: "Monarch", url: "https://onyx.example/monarch" },
      { name: "Geometry", url: "https://onyx.example/geometry" },
    ],
  };
  const nodes = docJsonLd(doc as never, "https://coffeejson.org/r/abc") as Record<string, unknown>[];
  expect(nodes.map((n) => n["name"])).toEqual(["Monarch", "Geometry"]);
  for (const n of nodes) expect(n["url"]).toBeUndefined();
  expect(nodes.map((n) => n["sameAs"])).toEqual(["https://onyx.example/monarch", "https://onyx.example/geometry"]);
});

// Both the card copy and the share controls branch on `siblings`. Pinned as an
// invariant rather than a count, so it stays true as the corpus grows.
test("siblings equals the number of index entries sharing a document slug", () => {
  const perSlug = new Map<string, number>();
  for (const e of index) perSlug.set(e.slug, (perSlug.get(e.slug) ?? 0) + 1);
  for (const e of index) expect(e.siblings, e.id).toBe(perSlug.get(e.slug));
  // And the multi-recipe case is genuinely exercised, not just handled.
  expect([...perSlug.values()].some((n) => n > 1), "no multi-recipe document").toBe(true);
});

// A roaster publishes a dial-in window as a RANGE rather than a point, and a
// formatter reading only `value` prints "undefined g" and "1 : NaN". Pinned as a
// property of the whole index: no rendered cell may contain a JavaScript accident.
test("no index cell renders undefined or NaN", () => {
  for (const e of index) {
    for (const [cell, v] of Object.entries(
      { coffee: e.coffee, brew: e.brew, ratio: e.ratio, temp: e.temp, totalTime: e.totalTime },
    )) expect(v, `${e.id} ${cell}`).not.toMatch(/undefined|NaN/);
  }
});

test("a range quantity renders as a range, and its ratio is the projection's", () => {
  // Both ends of a window are real, so the quantity renders as a window — but
  // the derived ratio is a single number and `normalize` derives it from the
  // midpoints. One derivation, so a card, a page and /r cannot disagree.
  const e = index.find((x) => x.slug === "cat-cloud-the-answer");
  expect(e, "cat-cloud-the-answer missing from the index").toBeDefined();
  expect(e!.coffee).toBe("18.5–19 g");
  expect(e!.brew).toBe("32–34 g");
  expect(e!.ratio).toBe("1 : 1.8");
});

test("attribution is present on every entry (launch transparency rule)", () => {
  for (const e of index) {
    expect(e.author.name.length).toBeGreaterThan(0);   // in-document author (party)
    expect(e.attribution.source_url).toMatch(/^https?:\/\//);  // the document's based_on
    expect(e.attribution.source_label.length).toBeGreaterThan(0);
  }
});
