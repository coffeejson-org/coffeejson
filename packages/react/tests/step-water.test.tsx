import { normalize } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RecipeCard } from "../src/RecipeCard";

const recipeOf = (r: object) =>
  normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;

// One recipe exercising the unsigned initial-fill row, an untargeted stir row that
// passes the chain through unbroken, and a signed +60 g increment — so the recipe
// has an increment beyond its initial fill and the Pour column shows.
const deltas = recipeOf({
  title: "V60",
  steps: [
    {
      kind: "pour",
      at_s: 0,
      to_water: { value: 60, unit: "gram" },
      instruction: "Bloom",
    },
    { kind: "stir", at_s: 30, instruction: "Stir gently" },
    {
      kind: "pour",
      at_s: 60,
      to_water: { value: 120, unit: "gram" },
      instruction: "Pour to 120g",
    },
  ],
});

// A single targeted step is the initial fill and nothing beyond it, so the whole
// recipe renders the plain nested-total markup with no Pour column.
const noDeltas = recipeOf({
  title: "V60 single pour",
  steps: [
    {
      kind: "pour",
      at_s: 0,
      to_water: { value: 50, unit: "gram" },
      instruction: "Bloom",
    },
    { kind: "stir", at_s: 45, instruction: "Stir gently" },
  ],
});

// Espresso: no to_water anywhere → no targets, no column.
const espresso = recipeOf({
  title: "Monarch",
  method: "espresso",
  coffee: { value: 19, unit: "gram" },
  yield: { value: 47, unit: "gram" },
  steps: [
    { kind: "extract", at_s: 0, instruction: "Start shot" },
    { kind: "stop", at_s: 28, instruction: "Stop shot" },
  ],
});

function stepRow(html: string, index: number): string {
  const m = new RegExp(
    `<li class="cj-step[^"]*" data-step="${index}">.*?</li>`,
    "s",
  ).exec(html);
  if (!m) throw new Error(`step row ${index} not found in: ${html}`);
  return m[0];
}

test("multi-pour recipe: the initial-fill row shows its own amount unsigned (no +, delta before target)", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={deltas} />);
  const row0 = stepRow(html, 0);
  expect(row0).toContain(
    '<span class="cj-step-delta">60 g</span> <strong class="cj-step-target">60 g</strong>',
  );
  expect(row0).not.toContain("+");
  expect(row0).not.toContain("cj-step-delta--none");
});

test("multi-pour recipe: a later pour is a signed +increment, delta before target", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={deltas} />);
  expect(stepRow(html, 2)).toContain(
    '<span class="cj-step-delta">+60 g</span> <strong class="cj-step-target">120 g</strong>',
  );
});

test("a step without to_water grows no target or delta spans (stir row)", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={deltas} />);
  const stir = stepRow(html, 1);
  expect(stir).not.toContain("cj-step-target");
  expect(stir).not.toContain("cj-step-delta");
});

test("single-target recipe renders the plain nested-total markup, no Pour column", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={noDeltas} />);
  // The target nests inside the body, with its leading space.
  expect(stepRow(html, 0)).toContain(
    '<strong class="cj-step-target"> 50 g</strong>',
  );
  expect(html).not.toContain("cj-step-delta");
});

test("espresso / untargeted recipe grows no water spans at all", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={espresso} />);
  expect(html).not.toContain("cj-step-target");
  expect(html).not.toContain("cj-step-delta");
});

test("mid-recipe underivable delta gets the — placeholder while the column still exists", () => {
  // 60 → 120 → 90 (a decrease: no positive delta) → 200. The column exists, so the
  // decreasing row keeps the placeholder rather than collapsing it.
  const dip = recipeOf({
    title: "Backwards pour",
    steps: [
      {
        kind: "pour",
        at_s: 0,
        to_water: { value: 60, unit: "gram" },
        instruction: "Fill",
      },
      {
        kind: "pour",
        at_s: 20,
        to_water: { value: 120, unit: "gram" },
        instruction: "Pour",
      },
      {
        kind: "pour",
        at_s: 40,
        to_water: { value: 90, unit: "gram" },
        instruction: "Oops",
      },
      {
        kind: "pour",
        at_s: 60,
        to_water: { value: 200, unit: "gram" },
        instruction: "Recover",
      },
    ],
  });
  const html = renderToStaticMarkup(<RecipeCard recipe={dip} />);
  expect(stepRow(html, 0)).toContain(
    '<span class="cj-step-delta">60 g</span> <strong class="cj-step-target">60 g</strong>',
  );
  expect(stepRow(html, 1)).toContain(
    '<span class="cj-step-delta">+60 g</span>',
  );
  expect(stepRow(html, 2)).toContain(
    '<span class="cj-step-delta cj-step-delta--none">—</span> <strong class="cj-step-target">90 g</strong>',
  );
  expect(stepRow(html, 3)).toContain(
    '<span class="cj-step-delta">+110 g</span>',
  );
});

test("out-of-vocabulary units: an undisplayable delta renders the placeholder, never a lone +", () => {
  // "liter" formats to "" yet core still derives positive liter deltas, so every
  // row must fall back to the placeholder rather than emit a bare "+".
  const liters = recipeOf({
    title: "Cold brew jug",
    steps: [
      {
        kind: "pour",
        at_s: 0,
        to_water: { value: 60, unit: "liter" },
        instruction: "Fill A",
      },
      {
        kind: "pour",
        at_s: 60,
        to_water: { value: 120, unit: "liter" },
        instruction: "Fill B",
      },
      {
        kind: "pour",
        at_s: 120,
        to_water: { value: 180, unit: "liter" },
        instruction: "Fill C",
      },
    ],
  });
  const html = renderToStaticMarkup(<RecipeCard recipe={liters} />);
  expect(html).not.toContain('<span class="cj-step-delta">+</span>');
  expect(html).not.toMatch(/>\+</); // no lone "+" text node anywhere
  expect(stepRow(html, 1)).toContain(
    '<span class="cj-step-delta cj-step-delta--none">—</span>',
  );
});

test("active-step highlight is unaffected by the columnar rendering", () => {
  const html = renderToStaticMarkup(
    <RecipeCard recipe={deltas} activeStepIndex={2} />,
  );
  expect((html.match(/cj-step--active/g) ?? []).length).toBe(1);
  expect(html).toContain('<li class="cj-step cj-step--active" data-step="2">');
});

// A volume-stated pour schedule renders exactly like a mass-stated one: without a
// milliliter symbol every span here is empty and the whole water column vanishes.
const volumeSchedule = recipeOf({
  title: "Volume pour-over",
  method: "pour_over",
  coffee: { value: 20, unit: "gram" },
  water: { value: 320, unit: "milliliter" },
  steps: [
    {
      kind: "pour",
      at_s: 0,
      to_water: { value: 60, unit: "milliliter" },
      instruction: "Bloom",
    },
    {
      kind: "pour",
      at_s: 45,
      to_water: { value: 320, unit: "milliliter" },
      instruction: "Pour to 320",
    },
  ],
});

test("a volume water renders its Water fact row", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={volumeSchedule} />);
  expect(html).toContain(`data-cj-fact="water"`);
  expect(html).toContain(`<span class="cj-fact-value">320 mL</span>`);
});

test("a volume pour schedule renders unsigned fill then signed increment", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={volumeSchedule} />);
  expect(stepRow(html, 0)).toContain(
    '<span class="cj-step-delta">60 mL</span> <strong class="cj-step-target">60 mL</strong>',
  );
  expect(stepRow(html, 1)).toContain(
    '<span class="cj-step-delta">+260 mL</span> <strong class="cj-step-target">320 mL</strong>',
  );
  // No placeholder anywhere: every delta in this recipe is derivable now.
  expect(html).not.toContain("cj-step-delta--none");
});

test("a volume measurement is not converted by any unit system", () => {
  for (const units of ["metric", "imperial"] as const) {
    const html = renderToStaticMarkup(
      <RecipeCard recipe={volumeSchedule} config={{ units }} />,
    );
    expect(html, units).toContain(`<span class="cj-fact-value">320 mL</span>`);
  }
});
