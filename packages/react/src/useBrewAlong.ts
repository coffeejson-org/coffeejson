import type { NormalizedStep, TimerState } from "@coffeejson/core";
import { timerState } from "@coffeejson/core";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

export interface BrewAlongState {
  elapsedS: number;
  state: TimerState;
  running: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tapDone: () => void;
}

// The steps before the recipe's first timed cue are acknowledged from the start:
// nothing is counting toward them, so the clock must not wait to be tapped past them.
const leadingUntimed = (steps: readonly NormalizedStep[]): Set<number> => {
  const first = steps.findIndex((s) => s.atS !== null);
  return new Set(Array.from({ length: first === -1 ? 0 : first }, (_, i) => i));
};

// A 250 ms clock over the pure `timerState`, owning time-keeping ONLY — wake lock,
// vibrate and unload guard stay with the consumer. The clock does NOT depend on
// `steps` or `finishS`: a consumer calling normalize() in a component body passes a
// new array every render, and an effect listing it would restart every render. The
// inputs live in a ref and the effect depends on `running` alone.
export function useBrewAlong(
  steps: NormalizedStep[],
  finishS: number | null,
  // Auto-start on mount (default). Pass `false` to hold idle at 0 — e.g. behind a
  // "Start" button or a pre-start countdown — until the consumer calls `start()`.
  autoStart = true,
): BrewAlongState {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(autoStart);
  const [, force] = useReducer((n: number) => n + 1, 0);
  // `useRef` has no lazy initializer, so an eager `new Set(...)` would be rebuilt
  // and thrown away four times a second. Seeded on the first render instead.
  const acked = useRef<Set<number> | null>(null);
  acked.current ??= leadingUntimed(steps);
  const ackedSet = acked.current;
  // Seeding this with performance.now() would read the clock during render, an
  // impurity in a package that advertises pure, SSR-safe rendering.
  const startedAt = useRef<number | null>(null);
  const pausedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);

  // Kept current by an effect rather than a dependency list, so `tick` reads a
  // value at most one commit old — immaterial against a 250 ms tick.
  const inputs = useRef({ steps, finishS, elapsed });
  useEffect(() => {
    inputs.current = { steps, finishS, elapsed };
  });

  useEffect(() => {
    if (!running) return;
    if (startedAt.current === null) startedAt.current = performance.now();
    const anchor = startedAt.current;
    let live = true;
    // Typed off `setTimeout` itself: this file compiles under configurations that
    // disagree about what a timer handle is.
    let handle: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      if (!live) return;
      const t = Math.max(
        0,
        ((pausedAt.current ?? performance.now()) -
          anchor -
          pausedTotal.current) /
          1000,
      );
      setElapsed(t);
      const { steps: s, finishS: f } = inputs.current;
      if (timerState(s, f, t, acked.current!).finished) {
        setRunning(false);
        return;
      }
      handle = setTimeout(tick, 250);
    };
    tick();
    // `live` stops the stale callback acting, but an uncleared timeout still sits
    // in the queue after unmount.
    return () => {
      live = false;
      if (handle !== null) clearTimeout(handle);
    };
  }, [running]);

  // `start` and `reset` differ only in whether the clock runs afterwards.
  const rewind = useCallback((run: boolean) => {
    acked.current = leadingUntimed(inputs.current.steps);
    startedAt.current = performance.now();
    pausedAt.current = null;
    pausedTotal.current = 0;
    setElapsed(0);
    setRunning(run);
  }, []);
  const start = useCallback(() => rewind(true), [rewind]);
  const pause = useCallback(() => {
    if (pausedAt.current === null) {
      pausedAt.current = performance.now();
      setRunning(false);
    }
  }, []);
  const resume = useCallback(() => {
    if (pausedAt.current !== null) {
      pausedTotal.current += performance.now() - pausedAt.current;
      pausedAt.current = null;
      setRunning(true);
    }
  }, []);
  const reset = useCallback(() => rewind(false), [rewind]);
  // One identity for the life of the component: depending on `elapsed` would
  // re-render every consumer holding it four times a second.
  const tapDone = useCallback(() => {
    const { steps: s, finishS: f, elapsed: e } = inputs.current;
    const st = timerState(s, f, e, acked.current!);
    if (st.currentIndex !== null) {
      acked.current!.add(st.currentIndex);
      force();
    }
  }, []);

  return {
    elapsedS: elapsed,
    state: timerState(steps, finishS, elapsed, ackedSet),
    running,
    start,
    pause,
    resume,
    reset,
    tapDone,
  };
}
