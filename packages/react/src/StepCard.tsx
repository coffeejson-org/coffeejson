import type { NormalizedRecipe, TimerState } from "@coffeejson/core";
import { fmtStepTime } from "@coffeejson/core";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, fmt, pourAmount, resolveConfig } from "./config.js";

export interface StepCardProps {
  recipe: NormalizedRecipe;
  state: TimerState;
  /** `full` (default): step n/total + time + text + pour + total. `compact`: pour + total only. */
  variant?: "full" | "compact";
  config?: CoffeeJSONConfig;
}

// Pure: it reads `state.currentIndex` and never keeps a clock.
export function StepCard({ recipe, state, variant = "full", config }: StepCardProps) {
  const rc = resolveConfig(config);

  if (state.finished) {
    return <div className={`${cx("stepCard", rc)} cj-stepcard--done`}><span className={cx("stepCardMsg", rc)}>{rc.labels.brew.complete}</span></div>;
  }
  if (state.currentIndex === null) {
    return <div className={`${cx("stepCard", rc)} cj-stepcard--ready`}><span className={cx("stepCardMsg", rc)}>{rc.labels.brew.getReady}</span></div>;
  }

  const i = state.currentIndex;
  const step = recipe.steps[i]!;
  const pour = pourAmount(recipe.steps, i, rc);
  const total = fmt(step.toWater, rc);
  const time = fmtStepTime(step.atS);

  return (
    <div className={`${cx("stepCard", rc)} cj-stepcard--${variant}`} data-awaiting={state.awaitingTap ? "true" : undefined}>
      {variant === "full" ? (
        <div className={cx("stepCardHead", rc)}>
          <span className={cx("stepCardStep", rc)}>{rc.labels.brew.step} {i + 1}/{recipe.steps.length}</span>
          <span className={cx("stepCardTime", rc)}>{time}</span>
        </div>
      ) : null}
      {variant === "full" && step.text ? <div className={cx("stepCardText", rc)}>{step.text}</div> : null}
      {pour ? <div className={cx("stepCardPour", rc)}><span className={cx("stepCardLabel", rc)}>{rc.labels.brew.pour}</span> {pour}</div> : null}
      {total ? <div className={cx("stepCardTotal", rc)}><span className={cx("stepCardLabel", rc)}>{rc.labels.brew.total}</span> {total}</div> : null}
    </div>
  );
}
