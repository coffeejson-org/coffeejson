// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { RenderOptions } from "../../src/element/render";
import { renderView } from "../../src/element/render";
import { defaultLabels } from "../../src/labels";
import { normalize } from "../../src/normalize";

// A string, not a `URL`, because under jsdom the global `URL` is jsdom's own,
// which Node's `fileURLToPath` does not accept.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (dir: string) =>
  readdirSync(`${root}/${dir}`)
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        [f, JSON.parse(readFileSync(`${root}/${dir}/${f}`, "utf8"))] as const,
    );

const opts: RenderOptions = {
  labels: defaultLabels,
  units: "as-authored",
  locale: "en",
};
const view = (doc: unknown, o: RenderOptions = opts) =>
  renderView(normalize(doc), o, document);

describe("renderView — a document as DOM", () => {
  test.each(read("fixtures/valid"))("fixture %s renders", (_, doc) => {
    const v = view(doc);
    // A tastings-only fixture has no card to draw, and says so with `null`.
    const n = normalize(doc);
    if (n.beans.length + n.recipes.length === 0) expect(v).toBeNull();
    else
      expect(v!.querySelectorAll(".cj-card").length).toBe(
        n.beans.length + n.recipes.length,
      );
  });

  test("a bean is a card of its facts, each addressable by id and by part", () => {
    const v = view({
      coffeejson: "1.1",
      beans: [
        {
          name: "Nano Challa",
          roaster: { name: "Example Roastery", url: "https://example.com" },
          process: ["washed"],
          roast_level: "light_medium",
          roast_date: "2026-06-20",
        },
      ],
    })!;
    expect(v.querySelector(".cj-title")!.textContent).toBe("Nano Challa");
    expect(v.querySelector(".cj-title")!.getAttribute("part")).toBe("cj-title");
    const roaster = v.querySelector('[data-cj-fact="roaster"] a')!;
    expect(roaster.getAttribute("href")).toBe("https://example.com");
    expect(v.querySelector('[data-cj-fact="roast"]')!.textContent).toContain(
      "2026-06-20",
    );
    expect(v.querySelector('[data-cj-fact="varietals"]')).toBeNull();
  });

  test("a recipe with more than one pour lays its water out in columns", () => {
    const v = view({
      coffeejson: "1.1",
      recipes: [
        {
          title: "Two pours",
          recommended: true,
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          steps: [
            {
              at_s: 0,
              to_water: { value: 50, unit: "gram" },
              instruction: "Bloom",
            },
            {
              at_s: 45,
              to_water: { value: 250, unit: "gram" },
              instruction: "Pour",
            },
          ],
        },
      ],
    })!;
    expect(v.querySelector(".cj-badge")!.textContent).toBe(defaultLabels.badge);
    const rows = v.querySelectorAll(".cj-step");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.querySelector(".cj-step-delta")!.textContent).toBe(
      "+200 g",
    );
    expect(
      rows[1]!.querySelector(":scope > .cj-step-target")!.textContent,
    ).toBe("250 g");
  });

  test("units and locale reach every measurement", () => {
    const doc = {
      coffeejson: "1.1",
      recipes: [
        {
          title: "T",
          coffee: { value: 15.5, unit: "gram" },
          water_temp: { value: 94, unit: "celsius" },
        },
      ],
    };
    const imperial = view(doc, { ...opts, units: "imperial" })!;
    expect(
      imperial.querySelector('[data-cj-fact="waterTemp"]')!.textContent,
    ).toContain("°F");
    const german = view(doc, { ...opts, locale: "de" })!;
    expect(
      german.querySelector('[data-cj-fact="coffee"]')!.textContent,
    ).toContain("15,5");
    // A malformed tag falls back instead of throwing.
    expect(() => view(doc, { ...opts, locale: "en_US" })).not.toThrow();
  });

  test("nothing to show is null", () => {
    expect(view({ coffeejson: "1.1" })).toBeNull();
    expect(view("not a document")).toBeNull();
  });
});

describe("renderView — a document is untrusted", () => {
  const hostile = {
    coffeejson: "1.1",
    generator: {
      name: "<script>alert(1)</script>",
      url: "javascript:alert(1)",
    },
    beans: [
      {
        name: '<img src=x onerror="alert(1)">',
        url: "javascript:alert(1)",
        roaster: { name: "R", url: "javascript:alert(1)" },
        description: "<b>bold</b>",
      },
    ],
    recipes: [
      {
        title: "<svg onload=alert(1)>",
        coffee: { value: 15, unit: "gram" },
        steps: [{ at_s: 0, instruction: "<iframe src=//evil.example>" }],
      },
    ],
  };

  test("markup in a document arrives as text, never as elements", () => {
    const v = view(hostile)!;
    expect(v.querySelector("img, svg, script, iframe, b")).toBeNull();
    expect(v.querySelector(".cj-bean-card .cj-title")!.textContent).toBe(
      '<img src=x onerror="alert(1)">',
    );
  });

  test("a URL that is not http, https or mailto makes no link", () => {
    const v = view(hostile)!;
    expect(v.querySelector("a")).toBeNull();
    expect(v.innerHTML).not.toContain("javascript:");
  });
});

describe("parts", () => {
  const doc = {
    coffeejson: "1.1",
    beans: [
      {
        name: "Nano Challa",
        roaster: { name: "Example Roastery", url: "https://example.com" },
      },
    ],
    recipes: [{ title: "Everyday V60" }],
  };

  test("every class is a part, so a page can tell a bean card from a recipe card", () => {
    const v = view(doc)!;
    for (const node of v.querySelectorAll("[class]"))
      expect(node.getAttribute("part")).toBe(node.getAttribute("class"));
    expect(v.querySelector('[part~="cj-bean-card"]')).not.toBeNull();
    expect(v.querySelector('[part~="cj-recipe-card"]')).not.toBeNull();
  });

  test("a link is a part", () => {
    expect(view(doc)!.querySelector("a")!.getAttribute("part")).toBe("cj-link");
  });
});
