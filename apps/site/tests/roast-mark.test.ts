import { defaultLabels } from "@coffeejson/core";
import { expect, test } from "vitest";
import { roastMark } from "../src/lib/roast-mark.mjs";

const levels = Object.keys(defaultLabels.roastLevels);

test("fills one cell per level up to the bag's own", () => {
  levels.forEach((level, n) => {
    const html = roastMark(level);
    expect((html.match(/<i/g) ?? []).length, level).toBe(levels.length);
    expect((html.match(/class="on"/g) ?? []).length, level).toBe(n + 1);
  });
});

test("says in words what it draws", () => {
  expect(roastMark("medium")).toContain(
    `aria-label="Roast: Medium, 3 of ${levels.length}"`,
  );
});

test("draws nothing for a level the vocabulary does not know", () => {
  expect(roastMark("burnt")).toBe("");
  expect(roastMark(null)).toBe("");
  expect(roastMark(undefined)).toBe("");
});
