import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import type { BeanFormState, RecipeFormState } from "../src/lib/builder";
import {
  buildDocument,
  emptyBeanForm,
  emptyOriginItemForm,
  emptyRecipeForm,
  emptyStepForm,
} from "../src/lib/builder";
import { validateDocument } from "../src/lib/validate";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const onyxFilter = JSON.parse(
  readFileSync(`${root}/recipes/onyx-monarch.json`, "utf8"),
);

const monarchBean = (): BeanFormState => ({
  ...emptyBeanForm(),
  name: "Monarch",
  roaster: "Onyx Coffee Lab",
  url: "https://onyxcoffeelab.com/products/monarch",
  process: "washed",
  roastLevel: "dark",
  description: "Onyx Monarch blend",
  origin: [
    { ...emptyOriginItemForm(), name: "The Queen", country: "CO" },
    {
      ...emptyOriginItemForm(),
      name: "Alaka G1 Natural",
      country: "ET",
      process: "natural",
    },
  ],
});

const kalitaRecipe = (): RecipeFormState => ({
  ...emptyRecipeForm(),
  title: "Onyx Monarch Kalita Wave",
  method: "pour_over",
  brewerLabel: "Kalita Wave 185",
  coffee: "25",
  water: "400",
  ratio: "16",
  recommended: true,
  waterTempC: "93",
  grindSetting: "medium",
  steps: [
    { ...emptyStepForm(), at_s: "0", cumulative: "50", instruction: "bloom" },
    {
      ...emptyStepForm(),
      at_s: "120",
      cumulative: "400",
      instruction: "finish",
    },
  ],
  finish_s: "210",
});

const espressoRecipe = (): RecipeFormState => ({
  ...emptyRecipeForm(),
  title: "Onyx Monarch Espresso",
  method: "espresso",
  coffee: "19",
  yield: "47",
  pressure: "9",
  preinfusion_s: "3.5",
  recommended: true,
  finish_s: "26.5",
});

test("the Onyx Monarch bag-to-brew bundle is reproducible from the builder and validates", () => {
  const doc = buildDocument({
    beanForms: [monarchBean()],
    recipeForms: [kalitaRecipe(), espressoRecipe()],
  });
  expect(validateDocument(doc)).toEqual([]);
  expect(doc.beans![0]!.name).toBe("Monarch");
  expect(doc.beans![0]!.origin!.items!.map((i) => i.name)).toContain(
    "Alaka G1 Natural",
  );
  const methods = doc.recipes!.map((r) => r.method);
  expect(methods).toEqual(["pour_over", "espresso"]);
  expect(doc.recipes!.every((r) => r.recommended)).toBe(true);
  // espresso recipe carries yield, not water; matches the corpus espresso shape
  expect(doc.recipes![1]!.yield).toEqual({ value: 47, unit: "gram" });
  expect(doc.recipes![1]!.water).toBeUndefined();
  // the filter recipe reproduces the corpus's key numbers
  expect(doc.recipes![0]!.water).toEqual({
    value: onyxFilter.recipes[0].water.value,
    unit: "gram",
  });
});
