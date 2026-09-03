import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// The generator is the site's second display surface for the same documents, and
// it renders at build time where the packages render at view time. That is where
// a rule the format already decides — which ratio wins, which facts in which
// order, how a clock reads — grows a second implementation that agrees today and
// disagrees after the next fix lands in one of them.
const gen = readFileSync(
  fileURLToPath(new URL("../tools/gen.mjs", import.meta.url)),
  "utf8",
);

test("the generator derives no quantity the projection already derives", () => {
  // A ratio, a basis and a unit conversion are `normalize`'s; reading raw
  // `coffee`/`water`/`yield`/`ratio` off a wire recipe is how they get re-derived.
  for (const wire of [
    "r.ratio",
    "r.coffee",
    "r.water",
    "r.yield",
    "r.water_temp",
    "r.finish_s",
    "r.grind",
  ])
    expect(gen, wire).not.toContain(wire);
  expect(
    gen,
    "espresso is a basis question, not a method comparison",
  ).not.toMatch(/method\s*===\s*"espresso"/);
});

test("the generator formats through the package, never a retyped formatter", () => {
  // Each of these is a core export retyped: a clock, a ratio, a role line.
  expect(gen).not.toMatch(/Math\.floor\(\s*\w+\s*\/\s*60\s*\)/);
  expect(gen).not.toMatch(/`1 : \$\{/);
  expect(gen).not.toMatch(/\(\$\{role\}\)/);
});

test("the generator reads no shape the schema does not define", () => {
  // A reader accepting a scalar where the schema says array is a dual-shape
  // branch: the document it accepts cannot exist, and ajv rejects it upstream.
  expect(gen).not.toMatch(
    /Array\.isArray\(\w+\)\s*\?\s*\w+\s*:\s*\w+\s*\?\s*\[\w+\]/,
  );
});
