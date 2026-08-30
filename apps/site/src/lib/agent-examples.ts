import { FORMAT_VERSION } from "@coffeejson/core";

// Exported rather than inlined into the page so the suite can validate every
// example against the AUTHORING schema: an agent-facing page that teaches an
// invalid shape is worse than no page at all.

/** A copy-pasteable system-prompt fragment for a model asked to emit CoffeeJSON. */
export const SYSTEM_PROMPT = `When asked to produce a coffee recipe as structured data, emit a CoffeeJSON document.

Rules:
- Top level is an object with "coffeejson": "${FORMAT_VERSION}" and a "recipes" array (and/or "beans").
- Every quantity is an object: { "value": <number>, "unit": "<canonical unit>" }.
  Canonical units are "gram", "ounce", "celsius", "fahrenheit", "bar". Never a bare number, never a display symbol like "g" or "°C".
- Steps are ordered. "at_s" is seconds from brew start, cumulative — not a duration.
- "to_water" is the CUMULATIVE water total at that step, not the amount added.
- Omit anything you do not know. Do not invent a value to fill a field.
- Validate against https://coffeejson.org/schema/authoring/1.0
  and fix what it rejects. That schema refuses unknown keys, so a typo fails loudly.`;

export interface Example {
  readonly prompt: string;
  readonly note: string;
  readonly doc: unknown;
}

/** Few-shot pairs: the request a user makes, and the document that answers it. */
export const EXAMPLES: readonly Example[] = [
  {
    prompt: "15 g coffee, 250 g water, V60.",
    note: "The floor. Only what was actually stated — no invented temperature, grind, or steps.",
    doc: {
      coffeejson: FORMAT_VERSION,
      recipes: [
        {
          title: "Everyday V60",
          method: "pour_over",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
      ],
    },
  },
  {
    prompt: "20 g coffee, 300 g water at 93 °C. Bloom with 60 g for 45 s, then pour to 300 g by 1:30.",
    note: "Note `to_water` is cumulative: the second pour reads 300, not 240. And `at_s` is the clock time the step starts, not how long it lasts.",
    doc: {
      coffeejson: FORMAT_VERSION,
      recipes: [
        {
          title: "Two-pour V60",
          method: "pour_over",
          coffee: { value: 20, unit: "gram" },
          water: { value: 300, unit: "gram" },
          water_temp: { value: 93, unit: "celsius" },
          steps: [
            { kind: "bloom", at_s: 0, to_water: { value: 60, unit: "gram" }, instruction: "Bloom and swirl." },
            { kind: "pour", at_s: 45, to_water: { value: 300, unit: "gram" }, instruction: "Pour in slow spirals." },
          ],
        },
      ],
    },
  },
  {
    prompt: "A washed Ethiopian from Onyx, light roast.",
    note: "A bean with no recipe is a complete document — `beans` and `recipes` are independent. Note `origin` is an object wrapping an `items` array (a blend is still ONE bean), and `country` is an ISO 3166-1 alpha-2 code.",
    doc: {
      coffeejson: FORMAT_VERSION,
      beans: [
        {
          name: "Ethiopia Washed",
          roaster: { name: "Onyx Coffee Lab", type: "organization" },
          roast_level: "light",
          origin: { type: "single", items: [{ country: "ET", process: ["washed"] }] },
        },
      ],
    },
  },
];

/** The mistakes a generating model actually makes, worth stating as anti-examples. */
export const PITFALLS: readonly { wrong: string; right: string; why: string }[] = [
  {
    wrong: `"coffee": 15`,
    right: `"coffee": { "value": 15, "unit": "gram" }`,
    why: "A bare number has no unit. The format never infers one from locale.",
  },
  {
    wrong: `"unit": "g"`,
    right: `"unit": "gram"`,
    why: "Units are canonical ids, not display symbols. `g` and `°C` are rejected.",
  },
  {
    wrong: `"to_water": 60  // meaning "add 60 g here"`,
    right: `"to_water": { "value": 260, "unit": "gram" }`,
    why: "`to_water` is the cumulative total in the vessel at that step, not the increment added.",
  },
  {
    wrong: `"at_s": 30  // meaning "this step takes 30 s"`,
    right: `"at_s": 90`,
    why: "`at_s` is seconds from the start of the brew — when the step begins.",
  },
  {
    wrong: `"grind": "medium-fine"`,
    right: `"grind": { "size": "medium_fine" }`,
    why: "Grind is a structured object, and vocabulary values are snake_case.",
  },
  {
    wrong: `"origin": [{ "country": "Ethiopia" }]`,
    right: `"origin": { "items": [{ "country": "ET" }] }`,
    why: "`origin` is an object wrapping `items` — a blend is still one bean — and `country` is an ISO 3166-1 alpha-2 code, not a name. (Both of these were caught by the schema while writing this page.)",
  },
];
