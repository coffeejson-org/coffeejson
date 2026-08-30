import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalize } from "../src/normalize";
import { hasSchedule, timerState } from "../src/timer";
import type { NormalizedRecipe, NormalizedStep } from "../src/normalize";

const recipe = (name: string): NormalizedRecipe =>
  normalize(JSON.parse(readFileSync(fileURLToPath(new URL(`../../../fixtures/valid/${name}`, import.meta.url)), "utf8"))).recipes[0]!;
const none = new Set<number>();

describe("typical-pour-over (all timed: 0s, 35s, 80s, finish 150)", () => {
  const { steps, finishS } = recipe("typical-pour-over.json");
  test("first cue at 0", () => expect(timerState(steps, finishS, 0, none)).toMatchObject({ currentIndex: 0, awaitingTap: false, nextTimedIndex: 1, finished: false }));
  test("mid-brew", () => expect(timerState(steps, finishS, 40, none)).toMatchObject({ currentIndex: 1, nextTimedIndex: 2, doneIndexes: [0] }));
  test("after last cue", () => expect(timerState(steps, finishS, 100, none)).toMatchObject({ currentIndex: 2, nextTimedIndex: null, finished: false }));
  test("finished", () => expect(timerState(steps, finishS, 150, none)).toMatchObject({ finished: true, currentIndex: null }));
});

describe("aeropress-mixed-steps", () => {
  const { steps, finishS } = recipe("aeropress-mixed-steps.json");
  const prepAcked = new Set([0]);
  test("at 0 pour current, prep done", () => expect(timerState(steps, finishS, 0, prepAcked)).toMatchObject({ currentIndex: 1, awaitingTap: false, doneIndexes: [0] }));
  test("untimed flip awaits tap, press upcoming", () => expect(timerState(steps, finishS, 20, prepAcked)).toMatchObject({ currentIndex: 3, awaitingTap: true, nextTimedIndex: 4 }));
  test("tapping flip resumes clock flow", () => expect(timerState(steps, finishS, 20, new Set([0, 3]))).toMatchObject({ currentIndex: 2, awaitingTap: false, nextTimedIndex: 4 }));
  test("unacked flip auto-acks when press cues", () => { const s = timerState(steps, finishS, 90, prepAcked); expect(s.doneIndexes).toContain(3); expect(s).toMatchObject({ currentIndex: 4, awaitingTap: false }); });
  test("finished only after finishS", () => { expect(timerState(steps, finishS, 100, prepAcked).finished).toBe(false); expect(timerState(steps, finishS, 115, prepAcked).finished).toBe(true); });
});

describe("edges", () => {
  const untimed: NormalizedStep[] = [
    { kind: "prep", atS: null, toWater: null, pourDelta: null, text: "a" },
    { kind: "press", atS: null, toWater: null, pourDelta: null, text: "b" },
  ];
  test("all-untimed is fully user-paced", () => {
    expect(timerState(untimed, null, 500, none)).toMatchObject({ currentIndex: 0, awaitingTap: true, finished: false });
    expect(timerState(untimed, null, 500, new Set([0]))).toMatchObject({ currentIndex: 1, awaitingTap: true });
    expect(timerState(untimed, null, 500, new Set([0, 1])).finished).toBe(true);
  });
  test("no finishS: finished once every step done", () => {
    const steps: NormalizedStep[] = [
      { kind: null, atS: 0, toWater: { value: 500, unit: "gram" }, pourDelta: null, text: "" },
      { kind: "stir", atS: 240, toWater: null, pourDelta: null, text: "" },
      { kind: "press", atS: null, toWater: null, pourDelta: null, text: "press" },
    ];
    expect(timerState(steps, null, 300, none)).toMatchObject({ currentIndex: 2, awaitingTap: true, finished: false });
    expect(timerState(steps, null, 300, new Set([2]))).toMatchObject({ finished: true, currentIndex: null });
  });
});

describe("hasSchedule — gates the brew-along affordance", () => {
  const recipeOf = (r: object): NormalizedRecipe => normalize({ coffeejson: "1.0", recipes: [r] }).recipes[0]!;
  test("true when a step carries a timed cue", () => {
    expect(hasSchedule(recipeOf({ title: "V60", steps: [{ at_s: 0, instruction: "Bloom" }] }))).toBe(true);
  });
  test("false when no step is timed (all user-paced)", () => {
    expect(hasSchedule(recipeOf({ title: "Aero", steps: [{ instruction: "Rinse filter" }, { kind: "press", instruction: "Press down" }] }))).toBe(false);
  });
  test("false for a recipe with no steps (espresso)", () => {
    expect(hasSchedule(recipeOf({ title: "Shot", method: "espresso", coffee: { value: 18, unit: "gram" }, yield: { value: 40, unit: "gram" } }))).toBe(false);
  });
});
