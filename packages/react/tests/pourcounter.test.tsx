import type { TimerState } from "@coffeejson/core";
import { normalize } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PourCounter } from "../src/PourCounter";

const recipeOf = (r: object) =>
  normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
const v60 = recipeOf({
  title: "V60",
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" } },
    { at_s: 45, to_water: { value: 150, unit: "gram" } },
    { at_s: 90, to_water: { value: 300, unit: "gram" } },
  ],
  finish_s: 150,
});
const st = (over: Partial<TimerState>): TimerState => ({
  currentIndex: null,
  awaitingTap: false,
  nextTimedIndex: null,
  doneIndexes: [],
  finished: false,
  ...over,
});

test("POUR n / N mid-brew (accent n)", () => {
  const html = renderToStaticMarkup(
    <PourCounter recipe={v60} state={st({ currentIndex: 1 })} />,
  );
  expect(html).toContain("POUR");
  expect(html).toContain('cj-pourcounter-n">2<'); // (currentIndex 1) + 1
  expect(html).toContain("/ 3");
});

test("Done when finished", () => {
  const html = renderToStaticMarkup(
    <PourCounter recipe={v60} state={st({ finished: true })} />,
  );
  expect(html).toContain("Done");
  expect(html).toContain("cj-pourcounter--done");
});

const mixed = recipeOf({
  title: "Mixed",
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" } },
    { at_s: 20, kind: "stir", instruction: "Swirl" },
    { at_s: 45, to_water: { value: 150, unit: "gram" } },
    { at_s: 90, to_water: { value: 300, unit: "gram" } },
    { at_s: 120, kind: "drain", instruction: "Let it drain" },
  ],
  finish_s: 150,
});

test("stir and drain steps are not pours", () => {
  const html = renderToStaticMarkup(
    <PourCounter recipe={mixed} state={st({ currentIndex: 3 })} />,
  );
  expect(html).toContain('cj-pourcounter-n">3<');
  expect(html).toContain("/ 3");
});

test("a recipe that never pours renders nothing", () => {
  const espresso = recipeOf({
    title: "Shot",
    steps: [{ at_s: 0, kind: "press", instruction: "Pull" }],
  });
  expect(
    renderToStaticMarkup(<PourCounter recipe={espresso} state={st({})} />),
  ).toBe("");
});
