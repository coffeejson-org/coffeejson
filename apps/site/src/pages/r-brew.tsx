import type { DecodedDocument, NormalizedRecipe } from "@coffeejson/core";
import { fmtClock } from "@coffeejson/core";
import { BrewControls, RecipeCard, useBrewAlong } from "@coffeejson/react";
import { useEffect, useRef } from "react";
import { SaveCta } from "./r-shared";

export function Brew({
  doc,
  recipe,
  onBack,
}: {
  doc: DecodedDocument;
  recipe: NormalizedRecipe;
  onBack: () => void;
}) {
  const brew = useBrewAlong(recipe.steps, recipe.finishS);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = async () => {
    try {
      wakeLock.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      /* unsupported */
    }
  };

  // Once the brew finishes, hold NEITHER — otherwise it keeps nagging "leave
  // site?" and pinning the screen awake.
  useEffect(() => {
    if (brew.state.finished) return;
    if (brew.running) void requestWakeLock();
    const onVis = () => {
      if (document.visibilityState === "visible" && brew.running)
        void requestWakeLock();
    };
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", guard);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", guard);
      void wakeLock.current?.release();
    };
  }, [brew.running, brew.state.finished]);

  // Vibrate cues: once per active-step change (skipping the null "no active step
  // yet" state), and a distinct pattern the moment the brew finishes.
  useEffect(() => {
    if (brew.state.currentIndex !== null) navigator.vibrate?.(200);
  }, [brew.state.currentIndex]);
  useEffect(() => {
    if (brew.state.finished) navigator.vibrate?.([200, 100, 200]);
  }, [brew.state.finished]);

  // The haptic cue says "something happened", not what to do, so the STEP is
  // announced. The clock stays aria-live="off": a per-second ticker read aloud is
  // unusable.
  const step =
    brew.state.currentIndex !== null
      ? recipe.steps[brew.state.currentIndex]
      : null;
  const announcement = brew.state.finished
    ? "Brew finished."
    : step
      ? [
          `Step ${brew.state.currentIndex! + 1} of ${recipe.steps.length}.`,
          step.text,
          step.toWater
            ? `Pour to ${step.toWater.value} ${step.toWater.unit}.`
            : "",
          brew.state.awaitingTap ? "Tap done when finished." : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  return (
    <>
      <header className="site-header">
        <a href="/">
          <strong>CoffeeJSON</strong>
        </a>
      </header>
      <h1>{recipe.title}</h1>
      <div className="clock" aria-live="off">
        {fmtClock(brew.elapsedS)}
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="row">
        <BrewControls brew={brew} variant="text" />
        <button
          type="button"
          className="btn btn--ghost"
          data-brew="back"
          onClick={onBack}
        >
          Back
        </button>
      </div>
      <div className="muted">
        {recipe.finishS !== null
          ? `Finish at ${fmtClock(recipe.finishS)}`
          : brew.state.nextTimedIndex !== null
            ? `Next cue at ${fmtClock(recipe.steps[brew.state.nextTimedIndex]!.atS!)}`
            : ""}
      </div>
      <div className="cj-brewing">
        <RecipeCard recipe={recipe} activeStepIndex={brew.state.currentIndex} />
      </div>
      {brew.state.finished ? <SaveCta doc={doc} prominent /> : null}
    </>
  );
}
