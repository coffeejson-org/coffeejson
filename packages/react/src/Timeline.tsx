import type { NormalizedRecipe, TimerState } from "@coffeejson/core";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, resolveConfig } from "./config.js";

export interface TimelineProps {
  recipe: NormalizedRecipe;
  state: TimerState;
  variant?: "dots" | "numbered";
  config?: CoffeeJSONConfig;
}

// An ordered list, so it reads correctly to assistive tech; the current marker
// carries aria-current.
export function Timeline({ recipe, state, variant = "dots", config }: TimelineProps) {
  const rc = resolveConfig(config);
  const done = new Set(state.doneIndexes);
  return (
    <ol className={`${cx("timeline", rc)} cj-timeline--${variant}`}>
      {recipe.steps.map((_, i) => {
        const status = i === state.currentIndex ? "current" : done.has(i) ? "done" : "future";
        return (
          <li
            key={i}
            className={`${cx("timelineMarker", rc)} cj-timeline-marker--${status}`}
            data-step={i}
            aria-current={status === "current" ? "step" : undefined}
          >
            {variant === "numbered" ? i + 1 : null}
          </li>
        );
      })}
    </ol>
  );
}
