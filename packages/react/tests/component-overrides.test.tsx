import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import { RecipeCard } from "../src/RecipeCard";
import type { CoffeeJSONConfig } from "../src/config";

const recipeOf = (r: object) => normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;

// A consumer swaps how a leaf part renders by passing
// `config.components.{Fact,Badge}`. An override receives semantic props and owns
// its markup — the default cj-* structure is replaced, not wrapped.

test("components.Fact replaces the default fact markup and receives id/label/value", () => {
  const config: CoffeeJSONConfig = {
    components: { Fact: ({ id, label, value }) => <li data-chip={id}>{label}={value}</li> },
  };
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", method: "pour_over",
    coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
    water_temp: { value: 93, unit: "celsius" },
  })} config={config} />);
  expect(html).toContain('<li data-chip="coffee">'); // override rendered, id passed
  expect(html).toContain("Coffee=20 g");              // label + value passed through
  expect(html).not.toContain('class="cj-fact"');      // default fact markup replaced
});

test("components.Fact override still suppresses empty-valued facts", () => {
  const config: CoffeeJSONConfig = {
    components: { Fact: ({ id }) => <li data-chip={id} /> },
  };
  // No grind → the grind fact has an empty value and must not render, even
  // through the override (empty-suppression stays the card's job).
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", method: "pour_over",
    coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
    water_temp: { value: 93, unit: "celsius" },
  })} config={config} />);
  expect(html).not.toContain('data-chip="grind"');
});

test("components.Badge replaces the recommended badge and receives its label", () => {
  const config: CoffeeJSONConfig = {
    components: { Badge: ({ label }) => <em className="brand-badge">{label}</em> },
  };
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", method: "pour_over", recommended: true,
    coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  })} config={config} />);
  expect(html).toContain('<em class="brand-badge">Recommended</em>');
  expect(html).not.toContain('class="cj-badge"');
});

test("no components override → default cj-* markup is unchanged", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={recipeOf({
    title: "V60", method: "pour_over", recommended: true,
    coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  })} />);
  expect(html).toContain('data-cj-fact="coffee"');
  expect(html).toContain('class="cj-badge"');
});
