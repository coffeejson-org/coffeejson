import type { DecodedDocument, NormalizedRecipe } from "@coffeejson/core";
import { fmtClock, fmtMeasurement } from "@coffeejson/core";
import { BrewControls, RecipeCard, useBrewAlong } from "@coffeejson/react";
import { useEffect, useRef } from "react";
import { PourCurve } from "./r-curve";
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

  // The view was replaced by this screen: focus goes to its first control, so a
  // keyboard reader is on Pause rather than back at the top of the page.
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stage.current?.parentElement
      ?.querySelector<HTMLElement>(".brew-controls button")
      ?.focus();
  }, []);

  // Space pauses and resumes, the way every timer does — unless a control has
  // focus, where Space is already that control's own key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || brew.state.finished) return;
      if ((e.target as HTMLElement | null)?.closest("button, a, input")) return;
      e.preventDefault();
      if (brew.running) brew.pause();
      else brew.resume();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [brew.running, brew.state.finished, brew.pause, brew.resume]);

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

  // The one thing a brew timer has to say besides the time: what happens
  // next, and how long until it does.
  const upcoming =
    brew.state.nextTimedIndex !== null
      ? recipe.steps[brew.state.nextTimedIndex]!
      : null;
  const countdown = (to: number) =>
    fmtClock(Math.max(0, Math.ceil(to - brew.elapsedS)));
  const next = brew.state.finished
    ? ""
    : upcoming && upcoming.atS !== null
      ? `Next: ${upcoming.text || "pour"} in ${countdown(upcoming.atS)}`
      : recipe.finishS !== null
        ? `Finish in ${countdown(recipe.finishS)}`
        : "";

  return (
    <>
      <header className="site-header">
        <a href="/">
          <strong>CoffeeJSON</strong>
        </a>
      </header>
      <h1>{recipe.title}</h1>
      <div
        ref={stage}
        className="brew-stage"
        data-paused={!brew.running && !brew.state.finished ? "" : undefined}
      >
        <div className="brew-now">
          <div className="clock" aria-live="off">
            {fmtClock(brew.elapsedS)}
          </div>
          {/* What the announcement says, for the eye. Hidden from assistive
              technology: the live region below is the one that speaks. */}
          <p className="brew-cue" aria-hidden="true">
            {brew.state.finished ? (
              "Brew finished."
            ) : step ? (
              <>
                {step.text}
                {step.toWater ? (
                  <span className="brew-target">
                    {fmtMeasurement(step.toWater)}
                  </span>
                ) : null}
              </>
            ) : (
              "Ready."
            )}
          </p>
          <p className="brew-next num" aria-hidden="true">
            {!brew.running && !brew.state.finished ? "Paused" : next}
          </p>
        </div>
        <PourCurve recipe={recipe} elapsedS={brew.elapsedS} />
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
      <div className="row brew-controls">
        <BrewControls brew={brew} variant="text" />
        <button
          type="button"
          className="btn btn--ghost btn--lg"
          data-brew="back"
          onClick={onBack}
        >
          Back
        </button>
      </div>
      <div className="cj-view cj-brewing">
        <RecipeCard recipe={recipe} activeStepIndex={brew.state.currentIndex} />
      </div>
      {brew.state.finished ? <SaveCta doc={doc} prominent /> : null}
    </>
  );
}
