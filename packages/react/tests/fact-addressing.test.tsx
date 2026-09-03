import { normalize } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { BeanCard } from "../src/BeanCard";
import { RecipeCard } from "../src/RecipeCard";

const recipeOf = (r: object) =>
  normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
const beanOf = (b: object) =>
  normalize({ coffeejson: "1.0", beans: [b] }).beans[0]!;

// Every fact row carries a stable `data-cj-fact` id, so a consumer hides or
// restyles one fact with CSS alone — `[data-cj-fact="grind"] { display: none }` —
// and needs no config knob.

test("recipe fact rows carry stable data-cj-fact ids", () => {
  const html = renderToStaticMarkup(
    <RecipeCard
      recipe={recipeOf({
        title: "V60",
        method: "pour_over",
        coffee: { value: 20, unit: "gram" },
        water: { value: 300, unit: "gram" },
        water_temp: { value: 93, unit: "celsius" },
        grind: { setting: "18" },
        finish_s: 180,
      })}
    />,
  );
  expect(html).toContain('data-cj-fact="coffee"');
  expect(html).toContain('data-cj-fact="water"');
  expect(html).toContain('data-cj-fact="ratio"');
  expect(html).toContain('data-cj-fact="waterTemp"');
  expect(html).toContain('data-cj-fact="grind"');
  expect(html).toContain('data-cj-fact="time"');
});

test("espresso-specific fact rows carry data-cj-fact ids", () => {
  const html = renderToStaticMarkup(
    <RecipeCard
      recipe={recipeOf({
        title: "Shot",
        method: "espresso",
        coffee: { value: 19, unit: "gram" },
        yield: { value: 47, unit: "gram" },
        water_temp: { value: 93, unit: "celsius" },
        pressure: { value: 9, unit: "bar" },
        preinfusion_s: 5,
      })}
    />,
  );
  expect(html).toContain('data-cj-fact="pressure"');
  expect(html).toContain('data-cj-fact="preinfusion"');
});

test("bean fact rows carry data-cj-fact ids, including the structural roaster/origin/notes rows", () => {
  const html = renderToStaticMarkup(
    <BeanCard
      bean={beanOf({
        name: "Las Brisas",
        roaster: { name: "Onyx" },
        origin: { items: [{ name: "Finca X", country: "CO" }] },
        process: ["washed"],
        varietals: ["Caturra"],
        roast_level: "light_medium",
        roaster_notes: ["Floral"],
      })}
    />,
  );
  expect(html).toContain('data-cj-fact="roaster"');
  expect(html).toContain('data-cj-fact="origin"');
  expect(html).toContain('data-cj-fact="process"');
  expect(html).toContain('data-cj-fact="varietals"');
  expect(html).toContain('data-cj-fact="roast"');
  expect(html).toContain('data-cj-fact="roasterNotes"');
});
