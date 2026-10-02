// @vitest-environment jsdom

import { decodePayload } from "@coffeejson/core";
import { beforeAll, expect, test, vi } from "vitest";
import hero from "../src/generated/hero-document.json";
import { landingBody } from "../src/pages/landing";

// The landing page's document is editable: move a pour and the file under it,
// and the link that carries the file, both change. jsdom has neither of the
// two browser APIs the module asks for at start-up, so they are stubbed inert.

interface Step {
  at_s: number;
  to_water: { value: number };
}
const published = (JSON.parse(hero.text).recipes[0].steps as Step[]).map(
  (s) => [s.at_s, s.to_water.value] as const,
);

beforeAll(async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
    },
  );
  HTMLElement.prototype.scrollTo = () => {};
  document.body.innerHTML = `<main id="app">${landingBody()}</main>`;
  await import("../src/lib/live-document");
});

const dot = (i: number) =>
  document.querySelectorAll<HTMLElement>(".live .curve-pt")[i]!;
const numbers = (step: number) =>
  [...document.querySelectorAll(`.ln[data-step="${step}"] .n`)]
    .slice(0, 2)
    .map((n) => Number(n.textContent));
const press = (i: number, key: string) =>
  dot(i).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
const open = () =>
  document.querySelector<HTMLAnchorElement>("[data-live-open]")!;
const linked = () => {
  const d = decodePayload(new URL(open().href).searchParams.get("d")!);
  if (!d.ok) throw new Error("the link does not decode");
  return (d.document.recipes![0] as { steps: Step[] }).steps;
};

test("each pour is a labeled slider that states its value", () => {
  expect(document.querySelector(".live")!.hasAttribute("data-ready")).toBe(
    true,
  );
  published.forEach(([at, w], i) => {
    expect(dot(i).getAttribute("role")).toBe("slider");
    expect(dot(i).tabIndex).toBe(0);
    expect(dot(i).getAttribute("aria-valuenow")).toBe(String(w));
    expect(numbers(i)).toEqual([at, w]);
  });
});

test("moving a pour rewrites its line of the file and the link", () => {
  const [at, w] = published[1]!;
  press(1, "ArrowUp");
  press(1, "ArrowRight");

  expect(numbers(1)).toEqual([at + 5, w + 5]);
  expect(dot(1).getAttribute("aria-valuetext")).toBe(`${w + 5} g at 0:50`);
  // The other steps' lines are untouched.
  expect(numbers(0)).toEqual([...published[0]!]);
  expect(numbers(2)).toEqual([...published[2]!]);

  const steps = linked();
  expect([steps[1]!.at_s, steps[1]!.to_water.value]).toEqual([at + 5, w + 5]);
  expect(open().textContent).toBe("open your version");
  expect(
    document.querySelector("[data-live-reset]")!.hasAttribute("hidden"),
  ).toBe(false);
});

test("a pour cannot reach its neighbors: cumulative water always rises", () => {
  // Far more presses than there is room for.
  for (let k = 0; k < 60; k++) press(1, "ArrowUp");
  for (let k = 0; k < 60; k++) press(1, "ArrowRight");
  const [at, w] = numbers(1);
  // One step short of the next pour, in weight and in time: a pour that adds
  // nothing is not a pour.
  expect(w).toBe(published[2]![1] - 5);
  expect(at).toBe(published[2]![0] - 5);
  for (let k = 0; k < 60; k++) press(1, "ArrowDown");
  expect(numbers(1)[1]).toBe(published[0]![1] + 5);
});

test("the last pour keeps its weight: it is the recipe's total", () => {
  const last = published.length - 1;
  press(last, "ArrowDown");
  press(last, "ArrowUp");
  expect(numbers(last)[1]).toBe(published[last]![1]);
  press(last, "ArrowLeft");
  expect(numbers(last)[0]).toBe(published[last]![0] - 5);
});

test("reset restores the published file and the published link", () => {
  document.querySelector<HTMLButtonElement>("[data-live-reset]")!.click();
  published.forEach(([at, w], i) => {
    expect(numbers(i)).toEqual([at, w]);
  });
  expect(open().getAttribute("href")).toBe(`/r/?d=${hero.payload}`);
  expect(open().textContent).toBe("brew it at real speed");
  expect(document.querySelector(".live")!.hasAttribute("data-edited")).toBe(
    false,
  );
});
