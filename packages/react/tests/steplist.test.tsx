import type { TimerState } from "@coffeejson/core";
import { normalize } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StepList } from "../src/StepList";

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
// No-text steps to exercise the derived "Pour to {target}" label.
const bare = recipeOf({
  title: "Bare",
  method: "pour_over",
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" } },
    {
      at_s: 45,
      to_water: { value: 150, unit: "gram" },
      instruction: "Second pour",
    },
  ],
  finish_s: 120,
});
// An untimed step between two timed ones — a shape this catalog never produces but
// any third-party document may. Pins the `at_s: null` placeholder and the bounds
// carry-forward.
const untimed = recipeOf({
  title: "Untimed",
  method: "pour_over",
  steps: [
    { at_s: 0, to_water: { value: 60, unit: "gram" }, instruction: "Bloom" },
    { instruction: "Swirl the bed" },
    {
      at_s: 90,
      to_water: { value: 180, unit: "gram" },
      instruction: "Second pour",
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

test("a step with no time renders the placeholder, not an empty cell", () => {
  const html = renderToStaticMarkup(
    <StepList
      recipe={untimed}
      state={st({ currentIndex: 1, doneIndexes: [0] })}
      elapsedS={30}
    />,
  );
  expect(html).toContain('<span class="cj-steplist-time">—</span>');
  expect(html).toContain(">0:00<"); // the timed siblings still show their clock
  expect(html).toContain(">1:30<");
});

test("one row per step plus a finish row; index + time render", () => {
  const html = renderToStaticMarkup(
    <StepList
      recipe={v60}
      state={st({ currentIndex: 1, doneIndexes: [0] })}
      elapsedS={45}
    />,
  );
  expect((html.match(/<li /g) ?? []).length).toBe(4); // 3 steps + finish
  expect(html).toContain("cj-steplist");
  expect(html).toContain(">0:45<"); // step 2 cue time
  expect(html).toContain('data-finish="true"');
});

test("derived 'Pour to {target}' label, overridden by a recipe's own step text", () => {
  const html = renderToStaticMarkup(
    <StepList recipe={bare} state={st({ currentIndex: 0 })} elapsedS={0} />,
  );
  expect(html).toContain("Pour to 60 g"); // derived (no instruction)
  expect(html).toContain("Second pour"); // text override wins
});

test("first targeted row shows its pour unsigned; later rows are +signed", () => {
  const html = renderToStaticMarkup(
    <StepList recipe={v60} state={st({ currentIndex: 1 })} elapsedS={45} />,
  );
  expect(html).toContain('cj-steplist-delta">60 g<'); // row 1 first target: unsigned absolute pour
  expect(html).toContain("+90 g"); // row 2 delta 150-60, signed
  expect(html).not.toContain("+60 g"); // first target is NOT +signed
});

test("the current row is aria-current + --current", () => {
  const html = renderToStaticMarkup(
    <StepList
      recipe={v60}
      state={st({ currentIndex: 2, doneIndexes: [0, 1] })}
      elapsedS={90}
    />,
  );
  expect(html).toContain("cj-steplist-row--current");
  expect(html).toContain('aria-current="step"');
});

test("finish row shows 'Finish' + the finishS clock", () => {
  const html = renderToStaticMarkup(
    <StepList recipe={v60} state={st({ finished: true })} elapsedS={150} />,
  );
  expect(html).toContain(">Finish<");
  expect(html).toContain(">2:30<"); // fmtClock(150)
  expect(html).toContain("cj-steplist-row--finish");
});

test("--cj-fill: 100% for a passed segment, 50% partial, 0% future (elapsedS=22.5)", () => {
  const html = renderToStaticMarkup(
    <StepList
      recipe={v60}
      state={st({ currentIndex: 1, doneIndexes: [0] })}
      elapsedS={22.5}
    />,
  );
  expect(html).toContain("--cj-fill:100%"); // row 0 (at_s 0, zero-width) fully filled
  expect(html).toContain("--cj-fill:50%"); // row 1 segment [0,45] half elapsed
  expect(html).toContain("--cj-fill:0%"); // row 2 segment [45,90] not started
});

// StepList and StepCard format through the same config-aware formatter, so a
// consumer who asks for imperial units gets ounces in both, on the same screen.
test("units config reaches the step list, matching the step card", () => {
  const html = renderToStaticMarkup(
    <StepList
      recipe={v60}
      state={st({ currentIndex: 1 })}
      elapsedS={45}
      config={{ units: "imperial" }}
    />,
  );
  expect(html).toContain("oz");
  expect(html).not.toContain(" g<");
});

test("labels.brew re-words the derived row label", () => {
  const html = renderToStaticMarkup(
    <StepList
      recipe={bare}
      state={st({ currentIndex: 0 })}
      elapsedS={0}
      config={{ labels: { brew: { pourTo: "Aufgießen bis" } } }}
    />,
  );
  expect(html).toContain("Aufgießen bis 60 g");
  expect(html).not.toContain("Pour to");
});
