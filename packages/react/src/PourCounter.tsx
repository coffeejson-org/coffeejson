import type { NormalizedRecipe, TimerState } from "@coffeejson/core";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, resolveConfig } from "./config.js";

export interface PourCounterProps {
  recipe: NormalizedRecipe;
  state: TimerState;
  config?: CoffeeJSONConfig;
}

export function PourCounter({ recipe, state, config }: PourCounterProps) {
  const rc = resolveConfig(config);
  if (state.finished)
    return (
      <p className={`${cx("pourCounter", rc)} cj-pourcounter--done`}>
        {rc.labels.brew.done}
      </p>
    );
  // `to_water` is the format's own marker of a pour; a stir is not one. A recipe
  // that pours nowhere renders nothing rather than "1 / 0".
  const pourAt = recipe.steps.flatMap((s, i) =>
    s.toWater !== null ? [i] : [],
  );
  if (pourAt.length === 0) return null;
  // Before the first pour the count reads 1: that is the pour being counted toward.
  const current = state.currentIndex ?? -1;
  const n = Math.max(1, pourAt.filter((i) => i <= current).length);
  return (
    <p className={cx("pourCounter", rc)}>
      {rc.labels.brew.pourCounter}{" "}
      <span className={cx("pourCounterN", rc)}>{n}</span> / {pourAt.length}
    </p>
  );
}
