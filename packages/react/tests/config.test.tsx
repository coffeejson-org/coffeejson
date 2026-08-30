import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import { RecipeCard } from "../src/RecipeCard";
import { CoffeeJSONView } from "../src/CoffeeJSONView";
import type { TimerState } from "@coffeejson/core";
import type { BrewAlongState } from "../src/useBrewAlong";
import { BrewAlong } from "../src/BrewAlong";
import type { CoffeeJSONConfig } from "../src/config";
import { fmt, resolveConfig } from "../src/config";

const recipe = (r: object) => normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
const espresso = recipe({ title: "M", method: "espresso", coffee: { value: 19, unit: "gram" }, yield: { value: 47, unit: "gram" }, water_temp: { value: 93, unit: "celsius" }, pressure: { value: 9, unit: "bar" }, grind: { setting: "3" } });

test("no config → identical to defaults (Dose/Water temp captions, all sections)", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={espresso} />);
  expect(html).toContain(">Dose<"); expect(html).toContain(">Water temp<"); expect(html).toContain(">Pressure<");
});
test("labels re-word captions (consumer re-wording)", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={espresso} config={{ labels: { facts: { dose: "Coffee", waterTemp: "Temperature" } } }} />);
  expect(html).toContain(">Coffee<"); expect(html).toContain(">Temperature<"); expect(html).not.toContain(">Dose<");
});
test("show hides sections", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={espresso} config={{ show: { grind: false, espresso: false } }} />);
  expect(html).not.toContain(">Grind<"); expect(html).not.toContain(">Pressure<");
});
test("units convert measurements", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={espresso} config={{ units: "imperial" }} />);
  expect(html).toContain("°F"); expect(html).not.toContain("°C");
});
test("classNames append to the frozen cj-* class, never replace it", () => {
  const html = renderToStaticMarkup(<CoffeeJSONView doc={{ coffeejson: "1.0", recipes: [{ title: "t" }] }} config={{ classNames: { card: "brand-card" } }} />);
  expect(html).toContain("cj-card brand-card");
});
test("show.bean false hides bean cards in the view", () => {
  const html = renderToStaticMarkup(<CoffeeJSONView doc={{ coffeejson: "1.0", beans: [{ name: "B" }], recipes: [{ title: "t" }] }} config={{ show: { bean: false } }} />);
  expect(html).not.toContain("cj-bean-card");
});

const recipeOf = (r: object) => normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
const v60 = recipeOf({
  title: "V60", method: "pour_over",
  coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" }, instruction: "Bloom" },
    { at_s: 45, to_water: { value: 150, unit: "gram" }, instruction: "Second pour" },
  ],
  finish_s: 150,
});
const st = (over: Partial<TimerState>): TimerState =>
  ({ currentIndex: null, awaitingTap: false, nextTimedIndex: null, doneIndexes: [], finished: false, ...over });
const noop = () => {};
const brewOf = (over: Partial<BrewAlongState>): BrewAlongState =>
  ({ elapsedS: 0, state: st({}), running: true, start: noop, pause: noop, resume: noop, reset: noop, tapDone: noop, ...over });

// One config object governs every component the package exports, not only the
// cards: `units: "imperial"` must not give ounces in the step card and grams in
// the step list.
test("labels.brew re-words every brew control and caption", () => {
  const config = {
    labels: { brew: { pause: "Anhalten", reset: "Neu starten", complete: "Fertig gebrüht" } },
  };
  const running = renderToStaticMarkup(<BrewAlong recipe={v60} brew={brewOf({ running: true })} config={config} />);
  expect(running).toContain("Anhalten");
  expect(running).toContain("Neu starten");
  expect(running).not.toContain("Pause");
  const done = renderToStaticMarkup(
    <BrewAlong recipe={v60} brew={brewOf({ running: false, state: st({ finished: true }) })} config={config} />,
  );
  expect(done).toContain("Fertig gebrüht");
});

test("classNames reaches the brew parts, additively", () => {
  const html = renderToStaticMarkup(
    <BrewAlong recipe={v60} brew={brewOf({ running: true })}
      config={{ classNames: { brew: "brand-brew", brewBtn: "brand-btn", timeline: "brand-timeline" } }} />,
  );
  expect(html).toContain(`class="cj-brew brand-brew"`);
  expect(html).toContain("cj-brew-btn brand-btn");
  expect(html).toContain("cj-timeline brand-timeline");
});

// The shared identity is what makes `rc` a memoizable prop rather than a fresh
// allocation per component per render.
test("resolveConfig returns one object per config identity", () => {
  const cfg: CoffeeJSONConfig = { units: "metric" };
  expect(resolveConfig(cfg)).toBe(resolveConfig(cfg));
  expect(resolveConfig()).toBe(resolveConfig());
  // A different object with the same contents is a different key — deliberately.
  expect(resolveConfig({ units: "metric" })).not.toBe(resolveConfig({ units: "metric" }));
  // Caching must not merge two configs into one.
  expect(resolveConfig({ units: "metric" }).units).toBe("metric");
  expect(resolveConfig({ units: "imperial" }).units).toBe("imperial");
});

// Digits still follow the requested locale — the formatter cache is keyed by it.
test("locale still drives digit formatting, per locale", () => {
  const de = resolveConfig({ locale: "de" });
  const en = resolveConfig({ locale: "en" });
  expect(fmt({ value: 15.25, unit: "gram" }, de)).toBe("15,3 g");
  expect(fmt({ value: 15.25, unit: "gram" }, en)).toBe("15.3 g");
});

// Intl.NumberFormat throws a RangeError on a malformed tag, and "en_US" is the
// commonest way to write one by mistake. A typo must not take down the render.
test("a malformed locale falls back instead of throwing", () => {
  for (const locale of ["en_US", "", "not a locale"]) {
    const rc = resolveConfig({ locale });
    expect(() => fmt({ value: 15.25, unit: "gram" }, rc), locale).not.toThrow();
    expect(fmt({ value: 15.25, unit: "gram" }, rc), locale).toBe("15.3 g");
  }
  // A well-formed but unknown tag is not malformed and is passed through.
  expect(() => fmt({ value: 1, unit: "gram" }, resolveConfig({ locale: "zz" }))).not.toThrow();
});

// A card must still render correctly with a malformed locale, end to end.
test("a malformed locale does not break a card render", () => {
  const html = renderToStaticMarkup(<RecipeCard recipe={espresso} config={{ locale: "en_US" }} />);
  expect(html).toContain("cj-recipe-card");
  expect(html).toContain("19 g");
});
