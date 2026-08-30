import type { CoffeeJSONDocument } from "@coffeejson/core";
import { FORMAT_VERSION } from "@coffeejson/core";

// The landing page prints TEXT and /generate seeds its form from DOC; one source,
// because two copies drift. TEXT is hand-aligned because `JSON.stringify(doc,
// null, 2)` turns eleven lines into seventeen, and sample.test.ts holds the two in
// step. `ratio` restates 250 ÷ 15 because the spec asks a producer knowing both to
// state both.
export const SAMPLE_DOC: CoffeeJSONDocument = {
  coffeejson: FORMAT_VERSION,
  recipes: [
    {
      title: "Everyday V60",
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
      ratio: 16.7,
    },
  ],
};

export const SAMPLE_TEXT = `{
  "coffeejson": "${FORMAT_VERSION}",
  "recipes": [
    {
      "title": "Everyday V60",
      "coffee": { "value": 15,  "unit": "gram" },
      "water":  { "value": 250, "unit": "gram" },
      "ratio":  16.7
    }
  ]
}`;
