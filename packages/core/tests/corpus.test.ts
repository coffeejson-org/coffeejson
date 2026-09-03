import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { decodePayload, encodePayload } from "../src/codec";
import { summary, unitSymbol } from "../src/format";
import { normalize } from "../src/normalize";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const docsIn = (dir: string): [string, unknown][] =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".json") && f !== "catalog.json")
    .map((f) => [
      join(dir, f),
      JSON.parse(readFileSync(join(root, dir, f), "utf8")),
    ]);

const corpus = [...docsIn("fixtures/valid"), ...docsIn("recipes")];

test("corpus is non-empty (paths still valid)", () => {
  expect(corpus.length).toBeGreaterThan(10);
});

test("every corpus document round-trips encode→decode byte-identically", () => {
  for (const [name, doc] of corpus) {
    const r = decodePayload(encodePayload(doc));
    expect(r.ok, name).toBe(true);
    if (r.ok)
      expect(JSON.stringify(r.document), name).toBe(JSON.stringify(doc));
  }
});

test("every corpus document normalizes to renderable content", () => {
  for (const [name, doc] of corpus) {
    const n = normalize(doc);
    expect(n.recipes.length + n.beans.length, name).toBeGreaterThan(0);
    for (const r of n.recipes) expect(typeof r.title, name).toBe("string");
  }
});

test("every corpus recipe yields a non-empty summary", () => {
  for (const [name, doc] of corpus)
    for (const r of normalize(doc).recipes)
      expect(summary(r).length, name).toBeGreaterThan(0);
});

// Any object carrying a string `unit` is a measurement, wherever it sits in the
// tree. Walking the raw JSON, not the view-model: normalize() drops what it
// cannot read, and the question is what the display layer cannot show.
function unitsIn(value: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) unitsIn(v, into);
    return into;
  }
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o["unit"] === "string") into.add(o["unit"]);
    for (const v of Object.values(o)) unitsIn(v, into);
  }
  return into;
}

// Must stay empty: an entry here is a measurement that silently disappears from
// every card, export and summary that touches it.
const UNDISPLAYABLE_CORPUS_UNITS: string[] = [];

test("the corpus uses no measurement unit the display layer cannot render", () => {
  const used = new Set<string>();
  for (const [, doc] of corpus) unitsIn(doc, used);
  expect(used.size).toBeGreaterThan(3); // the walk actually found measurements
  const undisplayable = [...used].filter((u) => unitSymbol(u) === "").sort();
  expect(undisplayable).toEqual([...UNDISPLAYABLE_CORPUS_UNITS].sort());
});

test("every corpus recipe's summary qualifies each magnitude with a unit", () => {
  for (const [name, doc] of corpus)
    for (const r of normalize(doc).recipes) {
      const s = summary(r);
      for (const part of s.split(" · ")) {
        // A part is either a ratio ("1:15") or "<magnitude> <symbol>[ label]".
        if (part.startsWith("1:")) continue;
        expect(part, `${name} → ${JSON.stringify(s)}`).toMatch(/^[\d.–+≤]+ \S/);
      }
    }
});
