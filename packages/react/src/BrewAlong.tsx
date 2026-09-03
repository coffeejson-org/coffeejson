import type { NormalizedRecipe } from "@coffeejson/core";
import { fmtClock } from "@coffeejson/core";
import { BrewControls } from "./BrewControls.js";
import { Countdown } from "./Countdown.js";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, resolveConfig } from "./config.js";
import { StepCard } from "./StepCard.js";
import { Timeline } from "./Timeline.js";
import type { BrewAlongState } from "./useBrewAlong.js";

export interface BrewAlongVariants {
  stepCard?: "full" | "compact";
  countdown?: { target?: "next" | "finish"; format?: "clock" | "seconds" };
  timeline?: "dots" | "numbered";
  /** `text` (default): labeled buttons. `icons`: the compact icon strip. */
  controls?: "text" | "icons";
}

export interface BrewAlongProps {
  recipe: NormalizedRecipe;
  /**
   * From `useBrewAlong(recipe.steps, recipe.finishS)`. The consumer owns the hook
   * — and any platform side effects (wake-lock, vibrate, unload guard) reacting to
   * `brew.running` / `brew.state` — so this component stays pure and SSR-safe.
   */
  brew: BrewAlongState;
  config?: CoffeeJSONConfig;
  variants?: BrewAlongVariants;
}

// Pure and props-driven: it never touches window/document/navigator, so
// `renderToStaticMarkup` works in any worker or edge runtime. A different
// arrangement composes the same primitives over `useBrewAlong` directly.
export function BrewAlong({ recipe, brew, config, variants }: BrewAlongProps) {
  const rc = resolveConfig(config);
  const { state, elapsedS, running } = brew;
  return (
    <div
      className={cx("brew", rc)}
      data-running={running ? "true" : undefined}
      data-finished={state.finished ? "true" : undefined}
    >
      <div className={cx("brewClock", rc)}>{fmtClock(elapsedS)}</div>
      <Timeline
        recipe={recipe}
        state={state}
        variant={variants?.timeline}
        config={config}
      />
      <StepCard
        recipe={recipe}
        state={state}
        variant={variants?.stepCard}
        config={config}
      />
      {!state.finished ? (
        <Countdown
          recipe={recipe}
          state={state}
          elapsedS={elapsedS}
          config={config}
          target={variants?.countdown?.target}
          format={variants?.countdown?.format}
        />
      ) : null}
      <BrewControls
        brew={brew}
        variant={variants?.controls ?? "text"}
        config={config}
      />
    </div>
  );
}
