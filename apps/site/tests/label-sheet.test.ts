import type { CoffeeJSONDocument } from "@coffeejson/core";
import { decodeScanned } from "@coffeejson/core";
import { describe, expect, test } from "vitest";
import { labelDocument } from "../src/lib/label-document";
import {
  buildLabel,
  defaultLabelSettings,
  LABEL_VIEWER,
  labelStatus,
  MIN_MODULE_MM,
  sheetSvg,
  textSizeMm,
} from "../src/lib/label-sheet";

const bean = {
  name: "Nano Challa",
  roaster: { name: "Example Roastery" },
  process: ["washed"],
  description: "A washed Ethiopian from the Nano Challa cooperative.",
};
const beanOnly = (): CoffeeJSONDocument => ({
  coffeejson: "1.1",
  beans: [bean],
});
const step = (i: number) => ({
  at_s: i * 20,
  to_water: { value: 20 * (i + 1), unit: "gram" as const },
  instruction: `Pour slowly in concentric circles, pass ${i + 1}, and wait.`,
});
const withRecipes = (n: number): CoffeeJSONDocument => ({
  coffeejson: "1.1",
  beans: [bean],
  recipes: Array.from({ length: n }, (_, r) => ({
    title: `Recipe ${r + 1}`,
    coffee: { value: 15, unit: "gram" as const },
    water: { value: 250, unit: "gram" as const },
    steps: Array.from({ length: 12 }, (_, i) => step(i)),
  })),
});
const dated = { ...defaultLabelSettings(), roastDate: "2026-10-01" };

describe("buildLabel — the code a sheet prints", () => {
  test("the URL opens the viewer and decodes to the label document exactly", async () => {
    const b = (await buildLabel(beanOnly(), dated))!;
    expect(b.url.startsWith(`${LABEL_VIEWER}?d=`)).toBe(true);
    const want = labelDocument(beanOnly(), { roastDate: "2026-10-01" })!.doc;
    expect(decodeScanned(b.url)).toEqual({ ok: true, document: want });
  });

  test("the roast date is in the code and under it", async () => {
    const b = (await buildLabel(beanOnly(), dated))!;
    expect(b.text).toBe("Roasted 2026-10-01");
    expect(sheetSvg(b)).toContain("Roasted 2026-10-01");
  });

  test("a reused sheet states no date in the code or under it", async () => {
    const b = (await buildLabel(beanOnly(), { ...dated, reuse: true }))!;
    expect(b.text).toBe("");
    expect(JSON.stringify(decodeScanned(b.url))).not.toContain("roast_date");
    expect(sheetSvg(b)).not.toContain("<text");
  });

  test("one code is drawn once and placed once per label", async () => {
    const b = (await buildLabel(beanOnly(), dated))!;
    const svg = sheetSvg(b);
    expect(svg.match(/<symbol /g)).toHaveLength(1);
    expect(svg.match(/<use /g)).toHaveLength(b.layout.cells.length);
    expect(svg).toContain('viewBox="0 0 210 297"');
  });

  test("no bean, no label", async () => {
    const { beans: _, ...recipeOnly } = withRecipes(1);
    expect(await buildLabel(recipeOnly, dated)).toBeNull();
  });
});

describe("labelStatus — what the panel says", () => {
  test("a small bag is fine, and names what it left out", async () => {
    const s = labelStatus((await buildLabel(beanOnly(), dated))!);
    expect(s.ok).toBe(true);
    expect(s.html).toContain("20 labels of 40 mm on one A4 page");
    expect(s.html).toContain("<code>description</code>");
    expect(s.html).not.toContain("too fine");
  });

  test("a dense code on a small label is warned about, and still printable", async () => {
    const b = (await buildLabel(withRecipes(3), { ...dated, labelMm: 25 }))!;
    expect(b.qr).not.toBeNull();
    expect(b.moduleMm).toBeLessThan(MIN_MODULE_MM);
    const s = labelStatus(b);
    expect(s.ok).toBe(true);
    expect(s.html).toContain("too fine to scan");
  });

  test("a document past the share-link cap gets no code, though it would compress small enough to draw", async () => {
    // Forty near-identical recipes are far past 8192 bytes of JSON and deflate
    // to a link a QR code could hold. A reader would refuse it on the scan.
    const b = (await buildLabel(withRecipes(40), dated))!;
    expect(b.url.length).toBeLessThan(2953);
    expect(b.qr).toBeNull();
    const s = labelStatus(b);
    expect(s.ok).toBe(false);
    expect(s.html).toContain("too large for a QR code");
    expect(sheetSvg(b)).toBe("");
  });

  test("a document under the cap that no code can hold gets no code either", async () => {
    // Text that does not compress is under the cap as JSON and past a QR's
    // ceiling as a link.
    let seed = 7;
    const noise = (n: number) =>
      Array.from({ length: n }, () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return String.fromCharCode(33 + (seed % 90));
      }).join("");
    const doc = beanOnly();
    doc.recipes = [
      {
        title: "Dense",
        coffee: { value: 15, unit: "gram" },
        notes: noise(6000),
      },
    ];
    const b = (await buildLabel(doc, dated))!;
    expect(b.url.length).toBeGreaterThan(2953);
    expect(b.qr).toBeNull();
    expect(labelStatus(b).ok).toBe(false);
  });

  test("a label that does not fit the page says so", async () => {
    const b = (await buildLabel(beanOnly(), {
      ...dated,
      labelMm: 80,
      marginMm: 30 + 40,
    }))!;
    const s = labelStatus(b);
    expect(s.ok).toBe(false);
    expect(s.html).toContain("does not fit the page");
  });
});

describe("the date line fits its label", () => {
  // One monospace character sets 0.6 of its size wide.
  const widthMm = (svg: string, text: string) =>
    Number(/font-size="([\d.]+)"/.exec(svg)![1]) * 0.6 * text.length;

  test("at 40 mm it is set at the full 3 mm", async () => {
    const b = (await buildLabel(beanOnly(), dated))!;
    expect(sheetSvg(b)).toContain('font-size="3"');
  });

  test.each([25, 28, 32])(
    "at %i mm it is narrower than the label",
    async (labelMm) => {
      const b = (await buildLabel(beanOnly(), { ...dated, labelMm }))!;
      expect(textSizeMm(labelMm, b.text)).toBeLessThan(3);
      expect(widthMm(sheetSvg(b), b.text)).toBeLessThanOrEqual(labelMm);
    },
  );
});

describe("a sheet date the format does not allow", () => {
  test("a five-digit year gets no code, and the status says why", async () => {
    const b = (await buildLabel(beanOnly(), {
      ...dated,
      roastDate: "12026-01-01",
    }))!;
    expect(b.problems.length).toBeGreaterThan(0);
    expect(b.qr).toBeNull();
    const s = labelStatus(b);
    expect(s.ok).toBe(false);
    expect(s.html).toContain("not valid");
    expect(s.html).toContain("roast_date");
  });

  test("a valid document has no problems", async () => {
    expect((await buildLabel(beanOnly(), dated))!.problems).toEqual([]);
  });
});

test("the code keeps crisp edges, and a second sheet can carry its own symbol id", async () => {
  const b = (await buildLabel(beanOnly(), dated))!;
  expect(sheetSvg(b)).toContain('<symbol id="label-qr" ');
  expect(sheetSvg(b)).toContain('shape-rendering="crispEdges"');
  const print = sheetSvg(b, "label-qr-print");
  expect(print).toContain('<symbol id="label-qr-print" ');
  expect(print).toContain('href="#label-qr-print"');
  expect(print).not.toContain('"#label-qr"');
});
