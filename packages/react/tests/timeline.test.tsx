import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import type { TimerState } from "@coffeejson/core";
import { Timeline } from "../src/Timeline";

const recipeOf = (r: object) => normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
const v60 = recipeOf({
  title: "V60", method: "pour_over",
  coffee: { value: 20, unit: "gram" }, water: { value: 300, unit: "gram" },
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" }, instruction: "Bloom" },
    { at_s: 45, to_water: { value: 150, unit: "gram" }, instruction: "Second pour" },
    { at_s: 90, to_water: { value: 300, unit: "gram" }, instruction: "Final pour" },
  ],
  finish_s: 150,
});
const st = (over: Partial<TimerState>): TimerState =>
  ({ currentIndex: null, awaitingTap: false, nextTimedIndex: null, doneIndexes: [], finished: false, ...over });

test("renders one marker per step, classed by done / current / future", () => {
  const html = renderToStaticMarkup(<Timeline recipe={v60} state={st({ currentIndex: 1, doneIndexes: [0] })} />);
  expect((html.match(/<li /g) ?? []).length).toBe(3);
  expect(html).toContain("cj-timeline-marker--done");
  expect(html).toContain("cj-timeline-marker--current");
  expect(html).toContain("cj-timeline-marker--future");
});

test("numbered variant renders step numbers", () => {
  const html = renderToStaticMarkup(<Timeline recipe={v60} state={st({ currentIndex: 0 })} variant="numbered" />);
  expect(html).toContain("cj-timeline--numbered");
  expect(html).toContain(">1<");
  expect(html).toContain(">3<");
});

test("the current step is marked aria-current for assistive tech", () => {
  const html = renderToStaticMarkup(<Timeline recipe={v60} state={st({ currentIndex: 2, doneIndexes: [0, 1] })} />);
  expect(html).toContain('aria-current="step"');
});
