import type { NormalizedRecipe, NormalizedStep } from "./normalize.js";

export interface TimerState {
  currentIndex: number | null;
  awaitingTap: boolean;
  nextTimedIndex: number | null;
  doneIndexes: number[];
  finished: boolean;
}

export function timerState(
  steps: NormalizedStep[],
  finishS: number | null,
  elapsedS: number,
  acked: ReadonlySet<number>,
): TimerState {
  // Everything before the latest fired cue is done, auto-acknowledging untimed
  // steps in between: array order is authoritative.
  let lastFired = -1;
  steps.forEach((s, i) => { if (s.atS !== null && s.atS <= elapsedS) lastFired = i; });

  const done = new Set<number>();
  for (let i = 0; i < steps.length; i++) if (i < lastFired || acked.has(i)) done.add(i);

  // The clock owns the fired timed step; an untimed successor takes over until
  // tapped, but only up to the next (future) timed cue.
  let currentIndex: number | null = lastFired >= 0 && !done.has(lastFired) ? lastFired : null;
  let awaitingTap = false;
  for (let i = lastFired + 1; i < steps.length; i++) {
    const step = steps[i]!;
    if (step.atS !== null) break;
    if (!done.has(i)) { currentIndex = i; awaitingTap = true; break; }
  }

  const nextTimed = steps.findIndex((s) => s.atS !== null && s.atS > elapsedS);
  const untimedRemaining = steps.some((s, i) => s.atS === null && i > lastFired && !done.has(i));
  const allSteps = steps.length > 0;
  const finished =
    allSteps && nextTimed === -1 && !untimedRemaining && (finishS === null || elapsedS >= finishS);

  return {
    currentIndex: finished ? null : currentIndex,
    awaitingTap,
    nextTimedIndex: nextTimed === -1 ? null : nextTimed,
    doneIndexes: [...done].sort((a, b) => a - b),
    finished,
  };
}

/**
 * Gate the "Brew along" affordance on this: an espresso or fully user-paced
 * recipe has no timed cue to count toward, and returns false.
 */
export function hasSchedule(recipe: NormalizedRecipe): boolean {
  return recipe.steps.some((s) => s.atS !== null);
}
