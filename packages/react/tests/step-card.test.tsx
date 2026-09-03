import type { TimerState } from "@coffeejson/core";
import { normalize } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StepCard } from "../src/StepCard";

const recipeOf = (r: object) =>
  normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
const v60 = recipeOf({
  title: "V60",
  method: "pour_over",
  coffee: { value: 20, unit: "gram" },
  water: { value: 300, unit: "gram" },
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" }, instruction: "Bloom" },
    {
      at_s: 45,
      to_water: { value: 150, unit: "gram" },
      instruction: "Second pour",
    },
    {
      at_s: 90,
      to_water: { value: 300, unit: "gram" },
      instruction: "Final pour",
    },
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

test("full variant shows step n/total, time, signed pour delta, and total", () => {
  const html = renderToStaticMarkup(
    <StepCard recipe={v60} state={st({ currentIndex: 1 })} />,
  );
  expect(html).toContain("Step 2/3");
  expect(html).toContain("0:45");
  expect(html).toContain("Second pour");
  expect(html).toContain("+90 g"); // delta 150-60, signed (not the first target)
  expect(html).toContain("150 g"); // running total
});

test("the first targeted step shows its fill unsigned", () => {
  const html = renderToStaticMarkup(
    <StepCard recipe={v60} state={st({ currentIndex: 0 })} />,
  );
  expect(html).toContain("60 g");
  expect(html).not.toContain("+60 g");
});

test("compact variant drops the step/time head but keeps pour + total", () => {
  const html = renderToStaticMarkup(
    <StepCard recipe={v60} state={st({ currentIndex: 1 })} variant="compact" />,
  );
  expect(html).not.toContain("Step 2/3");
  expect(html).toContain("+90 g");
  expect(html).toContain("150 g");
});

test("finished state renders a completion message, not a step", () => {
  const html = renderToStaticMarkup(
    <StepCard recipe={v60} state={st({ finished: true })} />,
  );
  expect(html.toLowerCase()).toContain("complete");
  expect(html).not.toContain("Step ");
});

test("pre-cue state renders a get-ready message", () => {
  const html = renderToStaticMarkup(
    <StepCard recipe={v60} state={st({ currentIndex: null })} />,
  );
  expect(html.toLowerCase()).toContain("get ready");
});

test("units config formats the timer numbers like the cards", () => {
  const html = renderToStaticMarkup(
    <StepCard
      recipe={v60}
      state={st({ currentIndex: 0 })}
      config={{ units: "imperial" }}
    />,
  );
  expect(html).toContain("oz");
  expect(html).not.toContain(" g");
});
