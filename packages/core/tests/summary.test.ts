import { expect, test } from "vitest";
import { normalize } from "../src/normalize";
import { summary } from "../src/format";

const recipeOf = (r: object) =>
  normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;

test("composes coffee · water · ratio · temp", () => {
  expect(summary(recipeOf({
    title: "t", coffee: { value: 15, unit: "gram" }, water: { value: 225, unit: "gram" },
    ratio: 15, water_temp: { value: 93, unit: "celsius" },
  }))).toBe("15 g coffee · 225 g water · 1:15 · 93 °C");
});

test("derived ratio appears when explicit ratio is absent", () => {
  expect(summary(recipeOf({
    title: "t", coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  }))).toBe("20 g coffee · 300 g water · 1:15");
});

test("espresso: dose, derived yield ratio, no water part", () => {
  expect(summary(recipeOf({
    title: "t", method: "espresso",
    coffee: { value: 19, unit: "gram" }, yield: { value: 47, unit: "gram" },
  }))).toBe("19 g coffee · 1:2.5");
});

test("values round to one decimal; missing parts are skipped; empty recipe → empty string", () => {
  expect(summary(recipeOf({ title: "t", coffee: { value: 15.25, unit: "gram" } }))).toBe("15.3 g coffee");
  expect(summary(recipeOf({ title: "t" }))).toBe("");
});

// `ratio` is water ÷ coffee BY MASS, so a volume water summarizes with its unit
// and still derives no ratio.
test("volume water summarizes with its unit and derives no ratio", () => {
  expect(summary(recipeOf({
    title: "t", method: "pour_over",
    coffee: { value: 20, unit: "gram" }, water: { value: 320, unit: "milliliter" },
  }))).toBe("20 g coffee · 320 mL water");
});

// A magnitude with no unit says nothing, so the whole part drops.
test("a measurement the display layer cannot render is skipped, not half-rendered", () => {
  expect(summary(recipeOf({
    title: "t", coffee: { value: 15, unit: "gram" }, water_temp: { value: 200, unit: "kelvin" },
  }))).toBe("15 g coffee");
});
