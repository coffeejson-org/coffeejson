// @vitest-environment jsdom

import { normalize } from "@coffeejson/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Brew } from "../src/pages/r-brew";

// Structure and control wiring, not the 250 ms tick loop: performance.now() is not
// faked, so advancing vi's fake setTimeout clock alone would not move elapsed.
// Step advancement is covered by core's timer.test.ts and react's
// use-brew-along.test.tsx.

// createRoot needs this flag for `act()` to flush effects deterministically.
// Testing Library sets it for you; these tests call createRoot and act directly.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const r = normalize({
  coffeejson: "1.0",
  recipes: [
    {
      title: "t",
      coffee: { value: 20, unit: "gram" },
      steps: [
        { at_s: 0, instruction: "Bloom" },
        { at_s: 30, instruction: "Pour" },
      ],
    },
  ],
}).recipes[0]!;

test("brew mode: clock + RecipeCard render inside .cj-brewing, active step matches the timer at t=0", () => {
  act(() =>
    root.render(
      <Brew doc={{ coffeejson: "1.0" }} recipe={r} onBack={() => {}} />,
    ),
  );

  expect(container.querySelector(".clock")?.textContent).toBe("0:00");

  const brewing = container.querySelector(".cj-brewing");
  expect(brewing).not.toBeNull();
  expect(brewing!.querySelector(".cj-recipe-card")).not.toBeNull();

  // The first cue (Bloom, at_s: 0) has already fired at t=0, so the timer's
  // currentIndex is 0 — RecipeCard must receive that as activeStepIndex.
  const active = brewing!.querySelector(".cj-step--active");
  expect(active).not.toBeNull();
  expect(active?.getAttribute("data-step")).toBe("0");
});

// The haptic cue says "something happened", not what to do. The clock stays silent
// on purpose — a per-second ticker read aloud is unusable — so the step is what
// must be announced.
test("a11y: the active step is announced politely; the clock stays silent", () => {
  act(() =>
    root.render(
      <Brew doc={{ coffeejson: "1.0" }} recipe={r} onBack={() => {}} />,
    ),
  );

  const live = container.querySelector("[role='status']");
  expect(live).not.toBeNull();
  expect(live!.getAttribute("aria-live")).toBe("polite");
  expect(live!.classList.contains("visually-hidden")).toBe(true);

  // At t=0 the first cue has already fired.
  expect(live!.textContent).toContain("Step 1 of 2");
  expect(live!.textContent).toContain("Bloom");

  expect(container.querySelector(".clock")?.getAttribute("aria-live")).toBe(
    "off",
  );
});

test("Back invokes onBack", () => {
  const onBack = vi.fn();
  act(() =>
    root.render(
      <Brew doc={{ coffeejson: "1.0" }} recipe={r} onBack={onBack} />,
    ),
  );
  act(() =>
    (
      container.querySelector("[data-brew='back']") as HTMLButtonElement
    )?.click(),
  );
  expect(onBack).toHaveBeenCalledOnce();
});

// The strip the package vends, not a copy of it: the site's own control is Back,
// and every brew control — "Start over" included — comes from `<BrewControls>`.
test("the control strip is the library's, and Back is the site's own", () => {
  act(() =>
    root.render(
      <Brew doc={{ coffeejson: "1.0" }} recipe={r} onBack={() => {}} />,
    ),
  );
  const controls = container.querySelector(".cj-brew-controls");
  expect(controls).not.toBeNull();
  const labels = [...controls!.querySelectorAll("button")].map(
    (b) => b.textContent,
  );
  expect(labels).toContain("Pause");
  expect(labels).toContain("Start over");
  expect(controls!.querySelector("[data-brew='back']")).toBeNull();
});

test("the curve is a clock: the playhead sits at the elapsed second", () => {
  const timed = normalize({
    coffeejson: "1.1",
    recipes: [
      {
        title: "t",
        coffee: { value: 20, unit: "gram" },
        steps: [
          {
            at_s: 0,
            to_water: { value: 60, unit: "gram" },
            instruction: "Bloom",
          },
          { at_s: 45, to_water: { value: 300, unit: "gram" } },
        ],
        finish_s: 180,
      },
    ],
  }).recipes[0]!;
  act(() =>
    root.render(
      <Brew doc={{ coffeejson: "1.1" }} recipe={timed} onBack={() => {}} />,
    ),
  );
  const figure = container.querySelector<HTMLElement>(".curve")!;
  expect(figure).not.toBeNull();
  expect(figure.dataset["playing"]).toBe("");
  expect(figure.style.getPropertyValue("--p")).toBe("0");
  const points = [...figure.querySelectorAll(".curve-pt")];
  expect(points[0]!.classList.contains("is-active")).toBe(true);
  expect(points[1]!.classList.contains("is-pending")).toBe(true);
  // What the screen reader hears, shown: the step and its target.
  expect(container.querySelector(".brew-cue")?.textContent).toBe("Bloom60 g");
  expect(
    container.querySelector(".brew-cue")?.getAttribute("aria-hidden"),
  ).toBe("true");
});

test("a recipe with no timed pours brews without a curve", () => {
  act(() =>
    root.render(
      <Brew doc={{ coffeejson: "1.0" }} recipe={r} onBack={() => {}} />,
    ),
  );
  expect(container.querySelector(".curve")).toBeNull();
  expect(container.querySelector(".brew-cue")?.textContent).toBe("Bloom");
});
