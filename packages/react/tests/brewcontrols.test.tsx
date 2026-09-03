import type { TimerState } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { BrewControls } from "../src/BrewControls";
import type { BrewAlongState } from "../src/useBrewAlong";

const st = (over: Partial<TimerState>): TimerState => ({
  currentIndex: 1,
  awaitingTap: false,
  nextTimedIndex: null,
  doneIndexes: [],
  finished: false,
  ...over,
});
const brewOf = (over: Partial<BrewAlongState>): BrewAlongState => ({
  elapsedS: 0,
  state: st({}),
  running: true,
  start() {},
  pause() {},
  resume() {},
  reset() {},
  tapDone() {},
  ...over,
});

test("Pause label while running, Resume while paused", () => {
  expect(
    renderToStaticMarkup(<BrewControls brew={brewOf({ running: true })} />),
  ).toContain('aria-label="Pause"');
  expect(
    renderToStaticMarkup(<BrewControls brew={brewOf({ running: false })} />),
  ).toContain('aria-label="Resume"');
});

test("Reset ('Start over') is always present; icons are aria-hidden", () => {
  const html = renderToStaticMarkup(<BrewControls brew={brewOf({})} />);
  expect(html).toContain('aria-label="Start over"');
  expect(html).toContain('aria-hidden="true"');
});

test("Pause/Resume hidden when finished; Reset remains", () => {
  const html = renderToStaticMarkup(
    <BrewControls brew={brewOf({ state: st({ finished: true }) })} />,
  );
  expect(html).not.toContain('aria-label="Pause"');
  expect(html).not.toContain('aria-label="Resume"');
  expect(html).toContain('aria-label="Start over"');
});

test("tapDone button only when awaitingTap", () => {
  expect(
    renderToStaticMarkup(<BrewControls brew={brewOf({})} />),
  ).not.toContain('aria-label="Done, next step"');
  expect(
    renderToStaticMarkup(
      <BrewControls brew={brewOf({ state: st({ awaitingTap: true }) })} />,
    ),
  ).toContain('aria-label="Done, next step"');
});

// The text variant is the same three buttons with their labels visible instead of
// an icon plus an accessible name — same conditions, handlers and classes.
test("the text variant renders labels as button text, with no aria-label", () => {
  const html = renderToStaticMarkup(
    <BrewControls brew={brewOf({ running: true })} variant="text" />,
  );
  expect(html).toContain(">Pause<");
  expect(html).toContain(">Start over<");
  expect(html).not.toContain("aria-label");
  expect(html).not.toContain("<svg");
});

test("both variants render the same buttons under the same conditions", () => {
  for (const variant of ["icons", "text"] as const) {
    const awaiting = renderToStaticMarkup(
      <BrewControls
        brew={brewOf({ state: st({ awaitingTap: true }) })}
        variant={variant}
      />,
    );
    const finished = renderToStaticMarkup(
      <BrewControls
        brew={brewOf({ state: st({ finished: true }) })}
        variant={variant}
      />,
    );
    expect((awaiting.match(/<button/g) ?? []).length, variant).toBe(3);
    expect((finished.match(/<button/g) ?? []).length, variant).toBe(1);
  }
});

test("labels.brew re-words the controls in both variants", () => {
  const config = {
    labels: { brew: { pause: "Anhalten", reset: "Neu starten" } },
  };
  const text = renderToStaticMarkup(
    <BrewControls
      brew={brewOf({ running: true })}
      variant="text"
      config={config}
    />,
  );
  expect(text).toContain(">Anhalten<");
  expect(text).toContain(">Neu starten<");
  const icons = renderToStaticMarkup(
    <BrewControls
      brew={brewOf({ running: true })}
      variant="icons"
      config={config}
    />,
  );
  expect(icons).toContain('aria-label="Anhalten"');
  expect(icons).toContain('aria-label="Neu starten"');
});
