// @vitest-environment node

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { App } from "../src/pages/r";

const bag = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/valid/bag-to-brew.json", import.meta.url),
    "utf8",
  ),
);
const pourOver = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/valid/typical-pour-over.json", import.meta.url),
    "utf8",
  ),
);

test("view mode: bean card, then all recipe cards stacked; Recommended badge shown", () => {
  const html = renderToStaticMarkup(
    <App doc={bag} initialMode={{ kind: "view" }} />,
  );
  expect(html).toContain('class="cj-view"');
  expect(html.indexOf("cj-bean-card")).toBeGreaterThan(-1);
  expect(html.indexOf("cj-bean-card")).toBeLessThan(
    html.indexOf("cj-recipe-card"),
  );
  expect((html.match(/cj-recipe-card/g) ?? []).length).toBe(bag.recipes.length);
  // bag-to-brew's recipes are step-less by design (co-location + recommended-picks
  // fixture — see fixtures/README.md; also asserted step-agnostic in
  // packages/react/tests/view.test.tsx), so no per-recipe brew CTA renders here.
  expect((html.match(/Start brewing/g) ?? []).length).toBe(0);
  expect(html).toContain("Las Brisas");
  expect(html).toContain("Recommended");
});

test("single-recipe doc with steps renders one card + Start brewing", () => {
  const html = renderToStaticMarkup(
    <App
      doc={{
        coffeejson: "1.0",
        recipes: [
          {
            title: "Solo",
            coffee: { value: 15, unit: "gram" },
            steps: [{ at_s: 0, instruction: "Bloom" }],
          },
        ],
      }}
      initialMode={{ kind: "view" }}
    />,
  );
  expect((html.match(/cj-recipe-card/g) ?? []).length).toBe(1);
  expect(html).toContain("Start brewing");
});

test("multi-pour recipe renders the columnar step schedule", () => {
  const html = renderToStaticMarkup(
    <App doc={pourOver} initialMode={{ kind: "view" }} />,
  );
  // That /r reaches the columnar variant at all is this page's to prove; the
  // sign-and-order rule belongs to the package that owns the markup.
  expect(html).toContain('class="cj-step-delta"');
});

test("step-less recipe: no Start brewing button", () => {
  const html = renderToStaticMarkup(
    <App
      doc={{
        coffeejson: "1.0",
        recipes: [{ title: "No steps", coffee: { value: 15, unit: "gram" } }],
      }}
      initialMode={{ kind: "view" }}
    />,
  );
  expect(html).not.toContain("Start brewing");
});

// A bag-to-brew publication holds several things a reader might want one of, and
// handing over the whole document gives them recipes they did not ask for.

test("a publication offers a share row per card, and a lone recipe does not", () => {
  const multi = renderToStaticMarkup(
    <App doc={bag} initialMode={{ kind: "view" }} />,
  );
  // bag-to-brew: one bean + its recipes, so one row each.
  expect((multi.match(/scoped-share/g) ?? []).length).toBe(
    1 + bag.recipes.length,
  );
  expect(multi).toContain("Take the bag on its own");
  expect(multi).toContain("Take this brew and the bag");

  // One recipe and nothing else: a per-card row would hand over exactly what
  // the panel below already does, and two identical rows read as two offers.
  const solo = renderToStaticMarkup(
    <App
      doc={{
        coffeejson: "1.0",
        recipes: [{ title: "Solo", coffee: { value: 15, unit: "gram" } }],
      }}
      initialMode={{ kind: "view" }}
    />,
  );
  expect(solo).not.toContain("scoped-share");
});

test("a bag with one brew offers the bag alone, and not the brew that IS the document", () => {
  // The brew's projection is the whole document, so offering it would put a second
  // button beside the panel doing the same thing while looking narrower. The bag's
  // projection is genuinely less, so that row stays.
  const html = renderToStaticMarkup(
    <App
      doc={{
        coffeejson: "1.0",
        beans: [{ name: "Sermon", roaster: { name: "Verve" } }],
        recipes: [
          {
            title: "Dwell",
            coffee: { value: 20, unit: "gram" },
            water: { value: 300, unit: "gram" },
          },
        ],
      }}
      initialMode={{ kind: "view" }}
    />,
  );
  expect((html.match(/scoped-share/g) ?? []).length).toBe(1);
  expect(html).toContain("Take the bag on its own");
  expect(html).not.toContain("Take this brew");
});

test("the whole-document panel names a multi-recipe document a publication, not a recipe", () => {
  const multi = renderToStaticMarkup(
    <App doc={bag} initialMode={{ kind: "view" }} />,
  );
  expect(multi).toContain("Save this publication");
  const solo = renderToStaticMarkup(
    <App
      doc={{
        coffeejson: "1.0",
        recipes: [{ title: "Solo", coffee: { value: 15, unit: "gram" } }],
      }}
      initialMode={{ kind: "view" }}
    />,
  );
  expect(solo).toContain("Save this recipe");
});

test("a brew-only publication says so, rather than promising a bag it has not got", () => {
  const html = renderToStaticMarkup(
    <App
      doc={{
        coffeejson: "1.0",
        recipes: [
          { title: "A", coffee: { value: 15, unit: "gram" } },
          { title: "B", coffee: { value: 18, unit: "gram" } },
        ],
      }}
      initialMode={{ kind: "view" }}
    />,
  );
  expect((html.match(/scoped-share/g) ?? []).length).toBe(2);
  expect(html).toContain("Take this brew on its own");
  expect(html).not.toContain("Take this brew and the bag");
});

const timed = {
  coffeejson: "1.1",
  recipes: [
    {
      title: "Timed",
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
      steps: [
        { at_s: 0, to_water: { value: 50, unit: "gram" } },
        { at_s: 45, to_water: { value: 250, unit: "gram" } },
      ],
      finish_s: 180,
    },
  ],
};

test("a recipe with timed pours shows its curve, whole", () => {
  const html = renderToStaticMarkup(
    <App doc={timed} initialMode={{ kind: "view" }} />,
  );
  expect((html.match(/<figure class="curve"/g) ?? []).length).toBe(1);
  expect(html).toContain('style="--p:1"');
  // Above the card it belongs to, inside the same block.
  expect(html.indexOf('class="curve"')).toBeLessThan(
    html.indexOf("cj-recipe-card"),
  );
});

test("a recipe with nothing to plot shows no curve rather than an empty one", () => {
  const html = renderToStaticMarkup(
    <App doc={pourOver} initialMode={{ kind: "view" }} />,
  );
  const plottable = (pourOver.recipes[0].steps ?? []).filter(
    (s: { at_s?: number; to_water?: unknown }) =>
      s.at_s !== undefined && s.to_water,
  ).length;
  expect(html.includes('class="curve"')).toBe(plottable >= 2);
  expect(
    renderToStaticMarkup(<App doc={bag} initialMode={{ kind: "view" }} />),
  ).not.toContain('class="curve"');
});
