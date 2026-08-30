import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import type { TimerState } from "@coffeejson/core";
import { Countdown } from "../src/Countdown";

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

test("counts down to the next timed cue (clock format)", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ currentIndex: 0, nextTimedIndex: 1 })} elapsedS={30} />);
  expect(html).toContain("Next pour");
  expect(html).toContain("0:15"); // 45 - 30
});

test("seconds format", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ nextTimedIndex: 1 })} elapsedS={40} format="seconds" />);
  expect(html).toContain("5s"); // 45 - 40
});

test("target=finish counts to finishS", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ nextTimedIndex: 2 })} elapsedS={100} target="finish" />);
  expect(html.toLowerCase()).toContain("finish");
  expect(html).toContain("0:50"); // 150 - 100
});

test("no next cue → idle dash", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ currentIndex: 2, nextTimedIndex: null })} elapsedS={100} />);
  expect(html).toContain("—");
});

test("finished → done", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ finished: true })} elapsedS={150} />);
  expect(html.toLowerCase()).toContain("done");
});

test("shows the next pour amount (signed) alongside target=next", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ currentIndex: 0, nextTimedIndex: 1 })} elapsedS={30} />);
  expect(html).toContain("0:15");
  expect(html).toContain("cj-countdown-pour");
  expect(html).toContain("+90 g"); // next step's delta (150-60), signed like the step card
});

test("no pour amount for target=finish", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ nextTimedIndex: 2 })} elapsedS={100} target="finish" />);
  expect(html).not.toContain("cj-countdown-pour");
});

test("units config formats the next pour amount", () => {
  const html = renderToStaticMarkup(<Countdown recipe={v60} state={st({ currentIndex: 0, nextTimedIndex: 1 })} elapsedS={30} config={{ units: "imperial" }} />);
  expect(html).toContain("oz");
});
