// @vitest-environment jsdom

import type { NormalizedStep } from "@coffeejson/core";
import { normalize } from "@coffeejson/core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useBrewAlong } from "../src/useBrewAlong";

// createRoot needs this flag for `act()` to recognize the environment and flush
// effects deterministically. Testing Library sets it for you; these tests call
// createRoot and act directly.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const steps: NormalizedStep[] = [
  { kind: null, atS: 0, toWater: null, pourDelta: null, text: "Bloom" },
  { kind: null, atS: 30, toWater: null, pourDelta: null, text: "Pour" },
  { kind: null, atS: 90, toWater: null, pourDelta: null, text: "Finish pour" },
];
function Probe({
  finishS,
  steps: stepsProp,
}: {
  finishS: number | null;
  steps?: NormalizedStep[];
}) {
  const b = useBrewAlong(stepsProp ?? steps, finishS);
  return (
    <>
      <div
        data-current={String(b.state.currentIndex)}
        data-finished={String(b.state.finished)}
        data-elapsed={Math.floor(b.elapsedS)}
        onClick={() => b.tapDone()}
      />
      <button data-action="pause" onClick={() => b.pause()}>
        pause
      </button>
      <button data-action="resume" onClick={() => b.resume()}>
        resume
      </button>
    </>
  );
}
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "performance", "Date"],
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

test("auto-starts; active step advances as the clock passes each cue", () => {
  act(() => root.render(<Probe finishS={120} />));
  expect(container.firstChild).toHaveProperty("dataset");
  const el = () => container.querySelector("div")!;
  expect(el().getAttribute("data-current")).toBe("0");
  act(() => {
    vi.advanceTimersByTime(35_000);
  });
  expect(el().getAttribute("data-current")).toBe("1");
  act(() => {
    vi.advanceTimersByTime(60_000);
  }); // past 90s cue
  expect(el().getAttribute("data-current")).toBe("2");
});
test("finishes at finishS", () => {
  act(() => root.render(<Probe finishS={100} />));
  act(() => {
    vi.advanceTimersByTime(105_000);
  });
  expect(container.querySelector("div")!.getAttribute("data-finished")).toBe(
    "true",
  );
});
test("paused time is excluded from elapsed", () => {
  act(() => root.render(<Probe finishS={120} />));
  const el = () => container.querySelector("div")!;
  const btn = (action: string) =>
    container.querySelector(`[data-action="${action}"]`) as HTMLButtonElement;
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  act(() => {
    btn("pause").click();
  });
  act(() => {
    vi.advanceTimersByTime(20_000);
  }); // paused — must NOT count
  act(() => {
    btn("resume").click();
  });
  act(() => {
    vi.advanceTimersByTime(5_000);
  });
  expect(el().getAttribute("data-elapsed")).toBe("15"); // 10 + 5 active; 20 paused excluded
});
test("tapDone advances an awaiting-tap untimed step back to the clock-driven flow", () => {
  const untimedSteps: NormalizedStep[] = [
    { kind: null, atS: 0, toWater: null, pourDelta: null, text: "a" },
    { kind: null, atS: null, toWater: null, pourDelta: null, text: "b" },
    { kind: null, atS: 30, toWater: null, pourDelta: null, text: "c" },
  ];
  act(() => root.render(<Probe finishS={60} steps={untimedSteps} />));
  const el = () => container.querySelector("div")!;
  expect(el().getAttribute("data-current")).toBe("1"); // untimed step 1 current, awaiting tap
  act(() => {
    el().click();
  });
  expect(el().getAttribute("data-current")).toBe("0"); // tap acked it; back to the clock-driven step
});

test("autoStart=false holds idle at 0 until start() is called", () => {
  function IdleProbe() {
    const b = useBrewAlong(steps, 120, false);
    return (
      <div
        data-elapsed={Math.floor(b.elapsedS)}
        data-running={String(b.running)}
        onClick={() => b.start()}
      />
    );
  }
  act(() => root.render(<IdleProbe />));
  const el = () => container.querySelector("div")!;
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(el().getAttribute("data-running")).toBe("false"); // idle — the clock never started
  expect(el().getAttribute("data-elapsed")).toBe("0");
  act(() => {
    el().click();
  }); // start()
  act(() => {
    vi.advanceTimersByTime(3000);
  });
  expect(el().getAttribute("data-running")).toBe("true");
  expect(Number(el().getAttribute("data-elapsed"))).toBeGreaterThanOrEqual(2);
});

// The hook must survive a caller that rebuilds `steps` every render — normalize()
// inside a component body, the natural composition. Real timers: what is measured
// is a render loop that never involves a timer.
test("an unstable steps identity does not restart the clock", async () => {
  const DOC = {
    coffeejson: "1.0",
    recipes: [
      {
        title: "T",
        method: "pour_over",
        finish_s: 300,
        coffee: { value: 20, unit: "gram" },
        steps: [
          { at_s: 0, kind: "bloom" },
          { at_s: 30, kind: "pour" },
          { at_s: 90, kind: "pour" },
        ],
      },
    ],
  };
  let renders = 0;
  function Unstable() {
    renders++;
    const r = normalize(DOC).recipes[0]!; // fresh arrays on every render
    const b = useBrewAlong(r.steps, r.finishS);
    return <div data-e={b.elapsedS} />;
  }

  vi.useRealTimers();
  const el = document.createElement("div");
  document.body.appendChild(el);
  const localRoot = createRoot(el);
  localRoot.render(<Unstable />);
  await new Promise((res) => setTimeout(res, 200));
  const observed = renders;
  try {
    localRoot.unmount();
  } catch {
    /* a root mid-loop may refuse to unmount cleanly */
  }
  el.remove();

  // Generous so the test is not machine-speed dependent, and still three orders of
  // magnitude below a render loop.
  expect(observed).toBeLessThan(10);
});
