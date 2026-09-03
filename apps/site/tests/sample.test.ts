import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  buildDocument,
  collectDroppedPaths,
  documentToState,
} from "../src/lib/builder";
import { SAMPLE_DOC, SAMPLE_TEXT } from "../src/lib/sample";
import { validateDocument } from "../src/lib/validate";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const read = (p: string) => readFileSync(`${root}/${p}`, "utf8");

// The sample is printed as hand-aligned text on the landing page and seeded as a
// parsed object into /generate. Nothing but this test stops the two from drifting.
describe("the site's one example document", () => {
  test("the printed text and the seeded object are the same document", () => {
    expect(JSON.parse(SAMPLE_TEXT)).toEqual(SAMPLE_DOC);
  });

  test("it validates against the schema", () => {
    expect(validateDocument(SAMPLE_DOC)).toEqual([]);
  });

  // /generate opens on this document with the form already filled, so anything
  // the builder cannot re-emit would show up as a field that vanishes the first
  // time the reader touches an unrelated box.
  test("/generate can re-emit it without losing a field", () => {
    const rebuilt = buildDocument(documentToState(SAMPLE_DOC));
    expect(collectDroppedPaths(SAMPLE_DOC, rebuilt)).toEqual([]);
    expect(rebuilt).toEqual(SAMPLE_DOC);
  });

  // 250 ÷ 15 is 16.666…, and the figure the spec's worked example and
  // typical-pour-over.json both carry for these quantities is 16.7. If someone
  // changes the dose or the water, the ratio has to move with them.
  test("the stated ratio is water ÷ coffee, rounded the way the spec's own example rounds it", () => {
    const r = SAMPLE_DOC.recipes![0]!;
    // `value` is optional on a measurement — a stated window carries min/max
    // instead — so the sample being two point masses is part of what is asserted.
    const coffee = r.coffee.value,
      water = r.water?.value;
    expect([r.coffee.unit, r.water?.unit]).toEqual(["gram", "gram"]);
    expect([coffee, water]).toEqual([15, 250]);
    expect(r.ratio).toBe(Math.round((water! / coffee!) * 10) / 10);
    expect(read("fixtures/valid/typical-pour-over.json")).toContain(
      `"ratio": ${r.ratio}`,
    );
  });

  test("both pages take the document from here rather than keeping a copy", () => {
    for (const f of [
      "apps/site/src/pages/landing.ts",
      "apps/site/src/pages/generate.tsx",
    ]) {
      expect(read(f), `${f} does not import the shared sample`).toMatch(
        /from "\.\.\/lib\/sample"/,
      );
      // The placeholder text in /generate legitimately shows an envelope, so the
      // check is for the sample's own content, which only sample.ts should hold.
      expect(read(f), `${f} keeps a second copy of the sample`).not.toContain(
        "Everyday V60",
      );
    }
  });
});
