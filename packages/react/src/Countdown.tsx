import type { NormalizedRecipe, TimerState } from "@coffeejson/core";
import { fmtClock } from "@coffeejson/core";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, pourAmount, resolveConfig } from "./config.js";

export interface CountdownProps {
  recipe: NormalizedRecipe;
  state: TimerState;
  elapsedS: number;
  /** `next` (default): count down to the next timed cue. `finish`: to the drawdown finish. */
  target?: "next" | "finish";
  format?: "clock" | "seconds";
  config?: CoffeeJSONConfig;
}

// Pure: it keeps no clock, so when a cue fires the hook advances `state` and the
// value jumps to the following interval.
export function Countdown({
  recipe,
  state,
  elapsedS,
  target = "next",
  format = "clock",
  config,
}: CountdownProps) {
  const rc = resolveConfig(config);
  const label =
    target === "finish" ? rc.labels.brew.finishIn : rc.labels.brew.nextPourIn;
  const targetS =
    target === "finish"
      ? recipe.finishS
      : state.nextTimedIndex !== null
        ? recipe.steps[state.nextTimedIndex]!.atS
        : null;

  if (state.finished || targetS === null) {
    return (
      <div className={`${cx("countdown", rc)} cj-countdown--idle`}>
        <span className={cx("countdownLabel", rc)}>
          {state.finished ? rc.labels.brew.done : label}
        </span>
        <span className={cx("countdownValue", rc)}>—</span>
      </div>
    );
  }

  const remaining = Math.max(0, Math.ceil(targetS - elapsedS));
  const value =
    remaining === 0
      ? rc.labels.brew.now
      : format === "seconds"
        ? `${remaining}s`
        : fmtClock(remaining);
  const pour =
    target === "next" && state.nextTimedIndex !== null
      ? pourAmount(recipe.steps, state.nextTimedIndex, rc)
      : "";
  return (
    <div className={cx("countdown", rc)}>
      <span className={cx("countdownLabel", rc)}>{label}</span>
      <span className={cx("countdownValue", rc)}>{value}</span>
      {pour ? <span className={cx("countdownPour", rc)}>{pour}</span> : null}
    </div>
  );
}
