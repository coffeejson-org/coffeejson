import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import type { TimerState } from "@coffeejson/core";
import type { BrewAlongState } from "../src/useBrewAlong";
import { BrewAlong } from "../src/BrewAlong";

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
const noop = () => {};
const brewOf = (over: Partial<BrewAlongState>): BrewAlongState =>
  ({ elapsedS: 0, state: st({}), running: true, start: noop, pause: noop, resume: noop, reset: noop, tapDone: noop, ...over });

test("composes clock + timeline + step card + countdown while brewing", () => {
  const html = renderToStaticMarkup(
    <BrewAlong recipe={v60} brew={brewOf({ elapsedS: 30, state: st({ currentIndex: 0, nextTimedIndex: 1 }) })} />,
  );
  expect(html).toContain("cj-brew-clock");
  expect(html).toContain("0:30");
  expect(html).toContain("cj-timeline");
  expect(html).toContain("cj-stepcard");
  expect(html).toContain("cj-countdown");
  expect(html).toContain("Pause");
});

test("shows Resume when paused", () => {
  const html = renderToStaticMarkup(<BrewAlong recipe={v60} brew={brewOf({ running: false, state: st({ currentIndex: 0 }) })} />);
  expect(html).toContain("Resume");
  expect(html).not.toContain(">Pause<");
});

test("surfaces the Done—next control only while awaiting a tap", () => {
  const awaiting = renderToStaticMarkup(<BrewAlong recipe={v60} brew={brewOf({ state: st({ currentIndex: 1, awaitingTap: true }) })} />);
  expect(awaiting).toContain("Done, next step");
  const notAwaiting = renderToStaticMarkup(<BrewAlong recipe={v60} brew={brewOf({ state: st({ currentIndex: 1, awaitingTap: false }) })} />);
  expect(notAwaiting).not.toContain("Done, next step");
});

test("finished: no countdown, no pause, shows completion", () => {
  const html = renderToStaticMarkup(<BrewAlong recipe={v60} brew={brewOf({ running: false, state: st({ finished: true }) })} />);
  expect(html).not.toContain("cj-countdown");
  expect(html).not.toContain("Pause");
  expect(html.toLowerCase()).toContain("complete");
});

test("variants pass through to the primitives", () => {
  const html = renderToStaticMarkup(
    <BrewAlong recipe={v60} brew={brewOf({ elapsedS: 10, state: st({ currentIndex: 0, nextTimedIndex: 1 }) })}
      variants={{ timeline: "numbered", stepCard: "compact", countdown: { target: "finish" } }} />,
  );
  expect(html).toContain("cj-timeline--numbered");
  expect(html).toContain("cj-stepcard--compact");
  expect(html.toLowerCase()).toContain("finish");
});

// BrewAlong composes BrewControls rather than reimplementing it, so its controls
// and the standalone component cannot drift apart.
test("the composed controls are BrewControls, defaulting to the text variant", () => {
  const html = renderToStaticMarkup(<BrewAlong recipe={v60} brew={brewOf({ running: true })} />);
  expect(html).toContain("cj-brew-controls");
  expect(html).toContain(">Pause<");
  expect(html).not.toContain("<svg");   // text variant by default
});

test("variants.controls switches the strip to icons", () => {
  const html = renderToStaticMarkup(
    <BrewAlong recipe={v60} brew={brewOf({ running: true })} variants={{ controls: "icons" }} />);
  expect(html).toContain('aria-label="Pause"');
  expect(html).toContain("<svg");
});
