import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import { RecipeCard } from "../src/RecipeCard";

const recipeOf = (r: object) =>
  normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;

const filter = recipeOf({
  title: "Morning V60", method: "pour_over",
  brewer: { id: "b1", brand: "Hario", model: "V60" },
  coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  water_temp: { value: 93, unit: "celsius" },
  grind: { grinder: { id: "g1", label: "Comandante" }, setting: "18", microns_approx: 700 },
  steps: [
    { kind: "pour", at_s: 0, to_water: { value: 50, unit: "gram" }, instruction: "Bloom" },
    { kind: "stir", at_s: 45, instruction: "Stir gently" },
  ],
  finish_s: 180,
});

test("filter recipe renders title, subtitle, facts, steps", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={filter} />);
  expect(html).toContain('<article class="cj-card cj-recipe-card"');
  expect(html).toContain("Morning V60");
  expect(html).toContain("Pour-over");
  expect(html).toContain("Hario V60");
  expect(html).toContain(">Coffee<");               // Coffee and Water on separate rows
  expect(html).toContain(">20 g<");
  expect(html).toContain(">Water<");
  expect(html).toContain(">300 g<");
  expect(html).toContain("1 : 15");                 // Ratio
  expect(html).toContain("93 °C");
  expect(html).toContain("Comandante · 18 · ~700 µm");
  expect(html).toContain("[Stir] ");                // non-pour kind prefix
  expect((html.match(/<li class="cj-step/g) ?? []).length).toBe(2);
  expect(html).toContain("3:00");                   // Finish
});

test("a card never renders provenance — `generator` is a document fact", () => {
  // Provenance is a document fact, carried by the envelope's `generator`. Nothing
  // recipe-level is read for it, whatever the recipe carries.
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "t", source: { app: "OldApp", url: "https://old.example" },
  })} />);
  expect(html).not.toContain("old.example");
  expect(html).not.toContain("cj-source");
  expect(html).not.toContain("cj-generator");
});

test("espresso recipe renders dose→yield, espresso facts, Shot time", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "Monarch", method: "espresso",
    coffee: { value: 19, unit: "gram" }, yield: { value: 47, unit: "gram" },
    pressure: { value: 9, unit: "bar" }, preinfusion_s: 5, basket: { id: "bk", label: "VST" },
    finish_s: 28,
  })} />);
  expect(html).toContain("19 g → 47 g");
  expect(html).toContain("1 : 2.5");
  expect(html).toContain("Pressure");
  expect(html).toContain("5 s");
  expect(html).toContain("VST");
  expect(html).toContain("Shot time");
});

test("activeStepIndex adds cj-step--active to exactly that step", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={filter} activeStepIndex={1} />);
  expect((html.match(/cj-step--active/g) ?? []).length).toBe(1);
  expect(html).toContain('class="cj-step cj-step--active" data-step="1"');
});

test("recommended badge renders only when set", () => {
  expect(renderToStaticMarkup(<RecipeCard recipe={recipeOf({ title: "t", recommended: true })} />))
    .toContain(">Recommended<");
  expect(renderToStaticMarkup(<RecipeCard recipe={filter} />)).not.toContain("Recommended");
});

test("React escaping neutralizes markup in payload content", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({ title: "<script>alert(1)</script>" })} />);
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
});


test("renders an additions fact line and a notes paragraph", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "Iced 4:6", method: "pour_over",
    coffee: { value: 20, unit: "gram" }, water: { value: 150, unit: "gram" },
    notes: "Brew straight onto the ice.",
    additions: [{ type: "ice", amount: { value: 80, unit: "gram" } }],
  })} />);
  expect(html).toContain("Additions");                  // fact label
  expect(html).toContain("Ice · 80 g");                 // kind · amount
  expect(html).toContain('class="cj-notes"');           // reserved part
  expect(html).toContain("Brew straight onto the ice.");
});

test("a recipe without notes/additions renders neither part", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "Plain", method: "pour_over",
    coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
  })} />);
  expect(html).not.toContain("cj-notes");
  expect(html).not.toContain("Additions");
});

test("a stated filter renders as a gear fact, material first", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    filter: { material: "paper", label: "Hario tabbed" },
  })} />);
  expect(html).toContain(">Filter<");
  expect(html).toContain("Paper · Hario tabbed");
});

test("an unknown filter material falls back rather than printing the slug", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    filter: { material: "unobtainium" },
  })} />);
  expect(html).toContain(">Other<");
  expect(html).not.toContain("unobtainium");
});

test("a stated grind size reads as its label, between setting and microns", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    grind: { grinder: { id: "g1", label: "Comandante" }, setting: "18", size: "medium_fine", microns_approx: 700 },
  })} />);
  expect(html).toContain("Comandante · 18 · Medium-fine · ~700 µm");
});

test("a grind with no size renders the line without it", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    grind: { grinder: { id: "g1", label: "Comandante" }, setting: "18" },
  })} />);
  expect(html).toContain("Comandante · 18<");
});

test("an unrecognized grind size prints nothing — the scale has no other", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    grind: { grinder: { id: "g1", label: "Comandante" }, setting: "18", size: "ultra_fine" },
  })} />);
  expect(html).toContain("Comandante · 18<");
  expect(html).not.toContain("ultra_fine");
});

test("a step kind reads as its label, and one this build lacks reads as Other", () => {
  // The tag is the kind's label, never its token — and step `kind` names `other`,
  // so a kind from a later version lands there rather than leaking a slug.
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "Switch", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    steps: [
      { kind: "valve_close", at_s: 0, instruction: "Shut the switch" },
      { kind: "valve_open", at_s: 120, instruction: "Release" },
      { kind: "laminar_pour", at_s: 150, instruction: "A kind from later" },
      { kind: "pour", at_s: 10, to_water: { value: 250, unit: "gram" }, instruction: "Fill" },
    ],
  })} />);
  expect(html).toContain("[Close valve] Shut the switch");
  expect(html).toContain("[Open valve] Release");
  expect(html).toContain("[Other] A kind from later");
  expect(html).not.toContain("laminar_pour");
  expect(html).not.toContain("valve_close");
  // `pour` is the kind a step means when it states none, so it carries no tag.
  expect(html).toContain(">Fill<");
  expect(html).not.toContain("[Pour]");
});
