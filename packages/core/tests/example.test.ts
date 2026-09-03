import { expect, test } from "vitest";
import {
  decodeScanned,
  encodePayload,
  fmtClock,
  fmtMeasurement,
  formatRatio,
  normalize,
} from "../src/index";

// The README's end-to-end example, run. A sample nobody executes rots into a
// sample that does not compile, and this is the one a first integration copies.
test("decode a share link and read a recipe", () => {
  const link = `https://coffeejson.org/r?d=${encodePayload({
    coffeejson: "1.0",
    recipes: [
      {
        title: "Everyday V60",
        method: "pour_over",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
        steps: [
          {
            kind: "pour",
            at_s: 0,
            to_water: { value: 50, unit: "gram" },
            instruction: "Bloom",
          },
          {
            kind: "pour",
            at_s: 45,
            to_water: { value: 150, unit: "gram" },
            instruction: "First pour",
          },
          {
            kind: "pour",
            at_s: 90,
            to_water: { value: 250, unit: "gram" },
            instruction: "Final pour",
          },
        ],
      },
    ],
  })}`;

  const result = decodeScanned(link);
  if (!result.ok) throw new Error(result.error.kind);
  const recipe = normalize(result.document).recipes[0]!;

  const lines = [
    recipe.title,
    `${recipe.method} · ${fmtMeasurement(recipe.coffee)} → ${fmtMeasurement(recipe.water)} · ${formatRatio(recipe.ratio)}`,
    ...recipe.steps.map(
      (s) => `${fmtClock(s.atS!)} ${s.text} → ${fmtMeasurement(s.toWater)}`,
    ),
  ];

  expect(lines).toEqual([
    "Everyday V60",
    "pour_over · 15 g → 250 g · 1 : 16.7",
    "0:00 Bloom → 50 g",
    "0:45 First pour → 150 g",
    "1:30 Final pour → 250 g",
  ]);
});
