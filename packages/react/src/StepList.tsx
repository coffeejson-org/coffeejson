import type {
  NormalizedRecipe,
  NormalizedStep,
  TimerState,
} from "@coffeejson/core";
import { fmtClock, fmtStepTime } from "@coffeejson/core";
import type { CSSProperties } from "react";
import type { CoffeeJSONConfig, ResolvedConfig } from "./config.js";
import { cx, fmt, pourAmount, resolveConfig } from "./config.js";

export interface StepListProps {
  recipe: NormalizedRecipe;
  state: TimerState;
  elapsedS?: number;
  config?: CoffeeJSONConfig;
}

// Fill % [0..100] of the segment [prevStop, curStop] covered by `elapsed`. A
// zero-width segment — an untimed step, or the at_s=0 first row — reads as filled
// once `elapsed` reaches curStop, empty before.
function connectorFill(
  elapsed: number,
  prevStop: number,
  curStop: number,
): number {
  if (curStop <= prevStop) return elapsed >= curStop ? 100 : 0;
  const pct = ((elapsed - prevStop) / (curStop - prevStop)) * 100;
  return Math.max(0, Math.min(100, pct));
}

// The recipe's own step text wins; otherwise the neutral target-derived label.
// Empty when neither applies (a non-water untimed step).
function rowLabel(step: NormalizedStep, rc: ResolvedConfig): string {
  if (step.text) return step.text;
  const target = fmt(step.toWater, rc);
  return target ? `${rc.labels.brew.pourTo} ${target}` : "";
}

// Class-only: the connector track and fill are a ::before/::after the consumer
// styles from `--cj-fill` and the status class.
export function StepList({
  recipe,
  state,
  elapsedS = 0,
  config,
}: StepListProps) {
  const rc = resolveConfig(config);
  const { steps, finishS } = recipe;
  const done = new Set(state.doneIndexes);

  // Boundaries: [0, step0.atS, …, lastStep.atS, finishS], nulls carried forward
  // from the previous known stop. Row i's connector fills across [bounds[i], bounds[i+1]];
  // the finish row is row `steps.length`.
  const raw: (number | null)[] = [0, ...steps.map((s) => s.atS), finishS];
  let last = 0;
  const bounds = raw.map((v) => {
    if (v !== null) last = v;
    return last;
  });
  const fillStyle = (i: number): CSSProperties =>
    ({
      ["--cj-fill"]: `${connectorFill(elapsedS, bounds[i]!, bounds[i + 1]!)}%`,
    }) as CSSProperties;

  return (
    <ol className={cx("stepList", rc)}>
      {steps.map((step, i) => {
        const status =
          i === state.currentIndex
            ? "current"
            : done.has(i)
              ? "done"
              : "future";
        const delta = pourAmount(steps, i, rc);
        return (
          <li
            key={i}
            className={`${cx("stepListRow", rc)} cj-steplist-row--${status}`}
            data-step={i}
            aria-current={status === "current" ? "step" : undefined}
            style={fillStyle(i)}
          >
            <span className={cx("stepListIndex", rc)}>{i + 1}</span>
            <span className={cx("stepListTime", rc)}>
              {fmtStepTime(step.atS)}
            </span>
            <span className={cx("stepListLabel", rc)}>
              {rowLabel(step, rc)}
            </span>
            <span className={cx("stepListDelta", rc)}>{delta}</span>
          </li>
        );
      })}
      {finishS !== null ? (
        <li
          className={`${cx("stepListRow", rc)} cj-steplist-row--finish cj-steplist-row--${state.finished ? "done" : "future"}`}
          data-finish="true"
          style={fillStyle(steps.length)}
        >
          <span className={cx("stepListIndex", rc)} />
          <span className={cx("stepListTime", rc)}>{fmtClock(finishS)}</span>
          <span className={cx("stepListLabel", rc)}>
            {rc.labels.facts.finish}
          </span>
          <span className={cx("stepListDelta", rc)} />
        </li>
      ) : null}
    </ol>
  );
}
