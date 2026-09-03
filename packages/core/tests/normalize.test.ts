import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { normalize } from "../src/normalize";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const load = (p: string): unknown =>
  JSON.parse(readFileSync(join(root, p), "utf8"));

describe("shape", () => {
  test("non-object inputs yield an empty doc", () => {
    for (const v of [null, undefined, 42, "x", true, [1, 2]])
      expect(normalize(v)).toEqual({
        beans: [],
        recipes: [],
        tastings: [],
        generator: null,
      });
  });
  test("minimal fixture normalizes to one recipe with a title", () => {
    const n = normalize(load("fixtures/valid/minimal.json"));
    expect(n.recipes).toHaveLength(1);
    expect(typeof n.recipes[0]!.title).toBe("string");
  });
  test("a collection element that is not an object is skipped, the rest rendered", () => {
    // Envelope § Fields: a renderer MAY skip such an element; an importer rejects.
    const n = normalize({ coffeejson: "1.0", recipes: [17, { title: "t" }] });
    expect(n.recipes).toHaveLength(1);
    expect(n.recipes[0]!.title).toBe("t");
  });
});

describe("generator (a document-level fact, never a recipe one)", () => {
  const doc = (generator: unknown) =>
    normalize({ coffeejson: "1.0", generator, recipes: [{ title: "t" }] });

  test("projects onto the document", () => {
    expect(
      doc({
        name: "ExampleBrewApp",
        version: "2.3.0",
        url: "https://example.com/brewapp",
      }).generator,
    ).toEqual({
      name: "ExampleBrewApp",
      version: "2.3.0",
      url: "https://example.com/brewapp",
    });
  });
  test("absent reads as null", () => {
    expect(
      normalize({ coffeejson: "1.0", recipes: [{ title: "t" }] }).generator,
    ).toBeNull();
  });
  test("name is the whole identity — a nameless generator reads as absent", () => {
    // Not an object with holes: without `name` the value states nothing at all.
    expect(
      doc({ version: "2.3.0", url: "https://example.com/brewapp" }).generator,
    ).toBeNull();
    expect(doc({ name: "" }).generator).toBeNull();
    expect(doc({ name: 42 }).generator).toBeNull();
    expect(doc("ExampleBrewApp").generator).toBeNull();
  });
  test("optional members drop to null individually", () => {
    expect(doc({ name: "ExampleBrewApp" }).generator).toEqual({
      name: "ExampleBrewApp",
      version: null,
      url: null,
    });
  });
  test("a recipe-level `source` is NOT read — provenance lives on the envelope", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        { title: "t", source: { app: "OldApp", url: "https://old.example" } },
      ],
    });
    expect(n.generator).toBeNull();
    expect(n.recipes[0]).not.toHaveProperty("sourceUrl");
  });
});

describe("ratio derivation (from production ratioText semantics)", () => {
  const r = (extra: object) =>
    normalize({ coffeejson: "1.0", recipes: [{ title: "t", ...extra }] })
      .recipes[0]!;
  test("filter: water/coffee wins, else the explicit ratio", () => {
    expect(
      r({
        coffee: { value: 20, unit: "gram" },
        water: { value: 300, unit: "gram" },
      }).ratio,
    ).toBe(15);
    expect(
      r({
        coffee: { value: 20, unit: "gram" },
        water: { value: 300, unit: "gram" },
        ratio: 17,
      }).ratio,
    ).toBe(15);
    expect(r({ coffee: { value: 20, unit: "gram" }, ratio: 17 }).ratio).toBe(
      17,
    );
  });
  test("espresso: yield/coffee; explicit ratio ignored", () => {
    // `basis` stated, because a stray `ratio` is exactly what a yield-basis recipe
    // MUST NOT carry — with no basis to go on, it is what the derivation reads.
    const e = r({
      basis: "yield",
      method: "espresso",
      coffee: { value: 19, unit: "gram" },
      yield: { value: 47, unit: "gram" },
      ratio: 99,
    });
    expect(e.isEspresso).toBe(true);
    expect(e.ratio).toBeCloseTo(47 / 19);
  });
  test("guards: non-number ratio dropped; zero/absent coffee → null", () => {
    expect(
      r({
        coffee: { value: 20, unit: "gram" },
        water: { value: 300, unit: "gram" },
        ratio: "abc",
      }).ratio,
    ).toBe(15);
    expect(
      r({
        coffee: { value: 0, unit: "gram" },
        water: { value: 300, unit: "gram" },
      }).ratio,
    ).toBeNull();
    expect(r({ water: { value: 300, unit: "gram" } }).ratio).toBeNull();
  });
  test("non-finite / non-positive derived ratios are dropped to null", () => {
    expect(
      r({
        coffee: { value: 5e-324, unit: "gram" },
        water: { value: 1e308, unit: "gram" },
      }).ratio,
    ).toBeNull(); // overflow → Infinity → null
    expect(
      r({
        coffee: { value: 20, unit: "gram" },
        water: { value: -300, unit: "gram" },
      }).ratio,
    ).toBeNull(); // negative → null
    expect(
      r({ coffee: { value: 20, unit: "gram" }, ratio: -5 }).ratio,
    ).toBeNull(); // negative explicit → null
  });
});

describe("associated-bean pairing (from production associatedMember semantics)", () => {
  test("bag-to-brew: single bean co-locates onto its recipes", () => {
    const n = normalize(load("fixtures/valid/bag-to-brew.json"));
    expect(n.recipes[0]!.bean?.name).toBe("Las Brisas");
  });
  test("catalog-with-refs: bean_ref exact match", () => {
    const n = normalize(load("fixtures/valid/catalog-with-refs.json"));
    for (const r of n.recipes)
      if (r.bean)
        expect(
          n.beans.some((b) => b.id === r.bean!.id || n.beans.length === 1),
        ).toBe(true);
  });
  test("broken ref: no fallback", () => {
    const n = normalize({
      coffeejson: "1.0",
      beans: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      recipes: [{ title: "t", bean_ref: "zzz" }],
    });
    expect(n.recipes[0]!.bean).toBeNull();
  });
});

describe("steps and field hygiene", () => {
  test("null/non-object steps dropped; label wins over instruction", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          title: "t",
          steps: [
            null,
            "junk",
            {
              at_s: 0,
              label: "Bloom",
              instruction: "ignored",
              to_water: { value: 50, unit: "gram" },
            },
            { instruction: "Stir" },
          ],
        },
      ],
    });
    expect(n.recipes[0]!.steps).toEqual([
      {
        kind: null,
        atS: 0,
        toWater: { value: 50, unit: "gram" },
        pourDelta: { value: 50, unit: "gram" },
        text: "Bloom",
      },
      { kind: null, atS: null, toWater: null, pourDelta: null, text: "Stir" },
    ]);
  });
  test("recommended is strict-true only; absent gear labels are empty strings", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [{ title: "t", recommended: "yes", brewer: {} }],
    });
    expect(n.recipes[0]!.recommended).toBe(false);
    expect(n.recipes[0]!.brewerLabel).toBe("");
  });
});

describe("pourDelta derivation (vs. last known cumulative to_water)", () => {
  const withSteps = (steps: object[]) =>
    normalize({ coffeejson: "1.0", recipes: [{ title: "t", steps }] })
      .recipes[0]!.steps;

  test("basic sequence 60/120/180 g: initial fill 60, then +60 each step", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 60, unit: "gram" } },
      { at_s: 10, to_water: { value: 120, unit: "gram" } },
      { at_s: 20, to_water: { value: 180, unit: "gram" } },
    ]);
    expect(steps.map((s) => s.pourDelta)).toEqual([
      { value: 60, unit: "gram" }, // initial fill — baseline is an implicit 0
      { value: 60, unit: "gram" },
      { value: 60, unit: "gram" },
    ]);
  });

  test("a no-target step between pours doesn't break the chain", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 60, unit: "gram" } },
      { at_s: 15, instruction: "Stir" }, // no to_water of its own
      { at_s: 30, to_water: { value: 120, unit: "gram" } },
    ]);
    expect(steps.map((s) => s.pourDelta)).toEqual([
      { value: 60, unit: "gram" }, // first targeted step — full initial fill
      null, // the stir has no usable to_water
      { value: 60, unit: "gram" }, // still vs. the 60 g cumulative — stir didn't break the chain
    ]);
  });

  test("mixed units: previous cumulative converted into the current step's unit", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 100, unit: "gram" } },
      { at_s: 10, to_water: { value: 5, unit: "ounce" } },
    ]);
    expect(steps[0]!.pourDelta).toEqual({ value: 100, unit: "gram" }); // initial fill
    // The package's own conversion factor, not a hand-rounded magic number.
    expect(steps[1]!.pourDelta).toEqual({
      value: 5 - 100 / 28.349523125,
      unit: "ounce",
    });
  });

  test("decreasing cumulative (120 -> 60): initial fill, then null", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 120, unit: "gram" } },
      { at_s: 10, to_water: { value: 60, unit: "gram" } },
    ]);
    expect(steps.map((s) => s.pourDelta)).toEqual([
      { value: 120, unit: "gram" },
      null,
    ]);
  });

  test("equal cumulative (120 -> 120): initial fill, then null", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 120, unit: "gram" } },
      { at_s: 10, to_water: { value: 120, unit: "gram" } },
    ]);
    expect(steps.map((s) => s.pourDelta)).toEqual([
      { value: 120, unit: "gram" },
      null,
    ]);
  });

  test("a zero-value initial fill is not a positive delta (null)", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 0, unit: "gram" } },
    ]);
    expect(steps[0]!.pourDelta).toBeNull();
  });

  test("no to_water anywhere (e.g. espresso) yields all-null pourDelta", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          title: "Monarch",
          method: "espresso",
          coffee: { value: 19, unit: "gram" },
          yield: { value: 47, unit: "gram" },
          steps: [
            { kind: "prep", instruction: "Lock in" },
            { kind: "extract", at_s: 0, instruction: "Start shot" },
            { kind: "stop", at_s: 28, instruction: "Stop shot" },
          ],
        },
      ],
    });
    expect(n.recipes[0]!.steps.map((s) => s.pourDelta)).toEqual([
      null,
      null,
      null,
    ]);
  });

  test("first targeted step (single-step recipe): the full initial fill", () => {
    const steps = withSteps([
      { at_s: 0, to_water: { value: 50, unit: "gram" } },
    ]);
    expect(steps[0]!.pourDelta).toEqual({ value: 50, unit: "gram" });
  });

  test("a step with an incomparable unit still becomes the new cumulative baseline", () => {
    // "liter" is not convertible against step 1's "gram", so step 2's own delta is
    // null — but its 2 L still becomes the baseline step 3 compares against.
    const steps = withSteps([
      { at_s: 0, to_water: { value: 60, unit: "gram" } },
      { at_s: 10, to_water: { value: 2, unit: "liter" } },
      { at_s: 20, to_water: { value: 3, unit: "liter" } },
    ]);
    expect(steps.map((s) => s.pourDelta)).toEqual([
      { value: 60, unit: "gram" }, // initial fill
      null, // liter vs. gram — incomparable, no delta
      { value: 1, unit: "liter" },
    ]);
  });
});

// normalize must never throw for any JSON-parseable value, whole or substituted
// field-by-field.
const BATTERY: unknown[] = [
  null,
  undefined,
  true,
  0,
  42,
  -1,
  "x",
  "__proto__",
  "",
  {},
  [],
  [null],
  { value: "x" },
  { a: { b: { c: [{ d: 1 }] } } },
  "x".repeat(5000),
];

const baseRecipe = {
  title: "Base recipe",
  method: "pour_over",
  brewer: { id: "b1", brand: "Hario", model: "V60" },
  coffee: { value: 20, unit: "gram" },
  water: { value: 300, unit: "gram" },
  yield: { value: 40, unit: "gram" },
  ratio: 15,
  water_temp: { value: 93, unit: "celsius" },
  grind: {
    grinder: { id: "g1", label: "Comandante" },
    setting: "18",
    microns_approx: 700,
  },
  pressure: { value: 9, unit: "bar" },
  preinfusion_s: 5,
  basket: { id: "bk1", label: "VST" },
  steps: [
    {
      kind: "pour",
      at_s: 0,
      to_water: { value: 50, unit: "gram" },
      instruction: "Bloom",
    },
  ],
  finish_s: 180,
  source: { app: "CoffeeJSON", version: "1.0", url: "https://example.com" },
  bean_ref: "bean1",
  recommended: true,
};
const baseBean = {
  id: "bean1",
  name: "Test Coffee",
  roaster: {
    name: "Test Roaster",
    url: "https://example-roastery.com",
    type: "organization",
  },
  url: "https://example.com/coffee",
  origin: {
    type: "single-origin",
    items: [
      {
        name: "Finca X",
        country: "CO",
        region: "Huila",
        process: "Washed",
        percentage: 100,
      },
    ],
  },
  process: "Washed",
  drying_method: "Patio",
  varietals: ["Caturra", "Bourbon"],
  roast_level: "medium",
  roast_agtron: 60,
  roast_date: "2026-01-01",
  roaster_notes: ["Floral", "Citrus"],
  description: "A lovely coffee.",
};

test("a party roaster normalizes to its display name; a nameless party reads as absent", () => {
  const doc = (roaster: unknown) => ({
    coffeejson: "1.0",
    beans: [{ name: "Bag", roaster }],
  });
  expect(
    normalize(
      doc({ name: "Test Roaster", url: "https://example-roastery.com" }),
    ).beans[0]!.roaster,
  ).toEqual({
    name: "Test Roaster",
    role: null,
    url: "https://example-roastery.com",
    type: null,
  });
  expect(
    normalize(doc({ url: "https://example-roastery.com" })).beans[0]!.roaster,
  ).toBeNull();
});

test("a grind projects its qualitative size, an unrecognized token included", () => {
  // Carried as authored, like every other closed set: dropping an unrecognized
  // token is the label layer's job, and a raw one is what `setting` competes with.
  const size = (v: unknown) =>
    normalize({
      coffeejson: "1.0",
      recipes: [{ ...baseRecipe, grind: { setting: "18", size: v } }],
    }).recipes[0]!.grind!.size;
  expect(size("medium_fine")).toBe("medium_fine");
  expect(size("clicky")).toBe("clicky");
  expect(size(7)).toBeNull();
  expect(size(undefined)).toBeNull();
});

test("a party carries its own url and type as authored", () => {
  const roaster = (r: unknown) =>
    normalize({ coffeejson: "1.0", beans: [{ name: "Bag", roaster: r }] })
      .beans[0]!.roaster;
  // Unfiltered: a link is checked where it becomes an `href`, not in the projection.
  expect(
    roaster({ name: "R", url: "javascript:alert(1)", type: "organization" }),
  ).toEqual({
    name: "R",
    role: null,
    url: "javascript:alert(1)",
    type: "organization",
  });
  expect(roaster({ name: "R", url: 7, type: {} })).toEqual({
    name: "R",
    role: null,
    url: null,
    type: null,
  });
});

test("whole-value battery: normalize never throws", () => {
  for (const v of BATTERY) expect(() => normalize(v)).not.toThrow();
});

test("field-substitution battery: every recipe/bean/doc field survives", () => {
  for (const field of Object.keys(baseRecipe))
    for (const v of BATTERY)
      expect(
        () =>
          normalize({
            coffeejson: "1.0",
            beans: [baseBean],
            recipes: [{ ...baseRecipe, [field]: v }],
          }),
        `recipe.${field}`,
      ).not.toThrow();
  for (const field of Object.keys(baseBean))
    for (const v of BATTERY)
      expect(
        () =>
          normalize({
            coffeejson: "1.0",
            beans: [{ ...baseBean, [field]: v }],
            recipes: [baseRecipe],
          }),
        `bean.${field}`,
      ).not.toThrow();
  for (const field of ["coffeejson", "beans", "recipes"])
    for (const v of BATTERY)
      expect(
        () =>
          normalize({
            coffeejson: "1.0",
            beans: [baseBean],
            recipes: [baseRecipe],
            [field]: v,
          }),
        `doc.${field}`,
      ).not.toThrow();
});

test("nested-substitution battery: nested sub-objects survive too", () => {
  for (const v of BATTERY) {
    expect(
      () =>
        normalize({
          coffeejson: "1.0",
          recipes: [
            {
              ...baseRecipe,
              grind: v,
              brewer: v,
              basket: v,
              steps: v,
              source: v,
            },
          ],
        }),
      `recipe-subobj ${String(v)}`,
    ).not.toThrow();
    expect(
      () =>
        normalize({
          coffeejson: "1.0",
          recipes: [
            {
              ...baseRecipe,
              grind: { grinder: v, setting: v, microns_approx: v },
            },
          ],
        }),
      `grind.${String(v)}`,
    ).not.toThrow();
    expect(
      () =>
        normalize({
          coffeejson: "1.0",
          recipes: [
            {
              ...baseRecipe,
              steps: [
                v,
                { kind: v, at_s: v, to_water: v, label: v, instruction: v },
              ],
            },
          ],
        }),
      `step.${String(v)}`,
    ).not.toThrow();
    expect(
      () =>
        normalize({
          coffeejson: "1.0",
          beans: [{ ...baseBean, origin: { type: v, items: v } }],
          recipes: [baseRecipe],
        }),
      `origin.${String(v)}`,
    ).not.toThrow();
    expect(
      () =>
        normalize({
          coffeejson: "1.0",
          beans: [
            {
              ...baseBean,
              origin: {
                type: "x",
                items: [v, { name: v, country: v, percentage: v }],
              },
            },
          ],
          recipes: [baseRecipe],
        }),
      `origin.item ${String(v)}`,
    ).not.toThrow();
  }
});

test("normalizes recipe notes and an ice addition", () => {
  const r = normalize({
    coffeejson: "1.0",
    recipes: [
      {
        title: "Iced 4:6",
        coffee: { value: 20, unit: "gram" },
        water: { value: 150, unit: "gram" },
        notes: "Brew onto the ice.",
        additions: [{ type: "ice", amount: { value: 80, unit: "gram" } }],
      },
    ],
  }).recipes[0]!;
  expect(r.notes).toBe("Brew onto the ice.");
  expect(r.additions).toHaveLength(1);
  expect(r.additions[0]).toEqual({
    kind: "ice",
    amount: { value: 80, unit: "gram" },
  });
});

test("an unknown addition type normalizes to 'other'; absent notes/additions are null/empty", () => {
  const withUnknown = normalize({
    coffeejson: "1.0",
    recipes: [
      {
        title: "X",
        coffee: { value: 18, unit: "gram" },
        additions: [{ type: "milk", amount: { value: 30, unit: "gram" } }],
      },
    ],
  }).recipes[0]!;
  expect(withUnknown.additions[0]!.kind).toBe("other");

  const bare = normalize({
    coffeejson: "1.0",
    recipes: [
      {
        title: "Plain",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
      },
    ],
  }).recipes[0]!;
  expect(bare.notes).toBeNull();
  expect(bare.additions).toEqual([]);
});

test("a stated filter is projected, material and label", () => {
  const n = normalize({
    coffeejson: "1.0",
    recipes: [
      {
        title: "V60",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
        filter: { material: "paper", label: "Hario tabbed" },
      },
    ],
  });
  expect(n.recipes[0]!.filter).toEqual({
    material: "paper",
    label: "Hario tabbed",
  });
});

test("a filter with no label keeps its material", () => {
  const n = normalize({
    coffeejson: "1.0",
    recipes: [
      {
        title: "Press",
        coffee: { value: 30, unit: "gram" },
        water: { value: 500, unit: "gram" },
        filter: { material: "metal" },
      },
    ],
  });
  expect(n.recipes[0]!.filter).toEqual({ material: "metal", label: null });
});

test("no filter projects null, not a hollow object", () => {
  const n = normalize({
    coffeejson: "1.0",
    recipes: [
      {
        title: "x",
        coffee: { value: 1, unit: "gram" },
        water: { value: 1, unit: "gram" },
      },
    ],
  });
  expect(n.recipes[0]!.filter).toBeNull();
});

describe("water derived from a stated ratio", () => {
  test("a dose and a ratio state a total, so one is projected", () => {
    const n = normalize(
      load("fixtures/valid/recipe-ratio-instead-of-water.json"),
    );
    const r = n.recipes[0]!;
    expect(r.water).toEqual({ value: 300, unit: "gram" });
    expect(r.ratio).toBe(15);
  });

  test("a stated water is never overwritten by the ratio", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          title: "both stated",
          coffee: { value: 20, unit: "gram" },
          water: { value: 320, unit: "gram" },
          ratio: 15,
        },
      ],
    });
    expect(n.recipes[0]!.water).toEqual({ value: 320, unit: "gram" });
  });

  test("a windowed dose derives a windowed water, not a midpoint", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          title: "scaled to the press",
          coffee: { min: 18, max: 20, unit: "gram" },
          ratio: 15,
        },
      ],
    });
    expect(n.recipes[0]!.water).toEqual({ min: 270, max: 300, unit: "gram" });
  });

  test("the dose's unit carries, because a ratio is by mass", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        { title: "ounces", coffee: { value: 0.7, unit: "ounce" }, ratio: 10 },
      ],
    });
    expect(n.recipes[0]!.water).toEqual({ value: 7, unit: "ounce" });
  });

  test("an unusable ratio derives nothing", () => {
    for (const ratio of [0, -15]) {
      const n = normalize({
        coffeejson: "1.0",
        recipes: [{ title: "bad", coffee: { value: 20, unit: "gram" }, ratio }],
      });
      expect(n.recipes[0]!.water).toBeNull();
    }
  });

  test("a yield-basis recipe derives no water — a ratio there is not water to coffee", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          title: "espresso",
          basis: "yield",
          coffee: { value: 18, unit: "gram" },
          yield: { value: 36, unit: "gram" },
        },
      ],
    });
    expect(n.recipes[0]!.water).toBeNull();
  });
});

describe("tastings", () => {
  const doc = {
    coffeejson: "1.0",
    beans: [
      { id: "nano-challa", name: "Nano Challa", roaster: { name: "R" } },
      { id: "las-brisas", name: "Las Brisas", roaster: { name: "R" } },
    ],
    recipes: [
      {
        id: "roasters-v60",
        title: "Roaster's V60",
        bean_ref: "nano-challa",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
      },
      {
        id: "other",
        title: "Other",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
      },
    ],
    tastings: [
      {
        id: "monday",
        recipe_ref: "roasters-v60",
        bean_ref: "las-brisas",
        rating: 4,
        perceived: { extraction: -0.2 },
        descriptors: ["blackberry", "dark chocolate"],
        note: "their method, my bag",
        lang: "en",
        measured: { tds: 1.38, yield: { value: 258, unit: "gram" } },
      },
    ],
  };

  test("a tasting is carried, not dropped", () => {
    expect(normalize(doc).tastings).toHaveLength(1);
  });

  test("every stated field survives the projection", () => {
    const t = normalize(doc).tastings[0]!;
    expect(t.id).toBe("monday");
    expect(t.rating).toBe(4);
    expect(t.perceived).toEqual({ extraction: -0.2, strength: null });
    expect(t.descriptors).toEqual(["blackberry", "dark chocolate"]);
    expect(t.note).toBe("their method, my bag");
    expect(t.lang).toBe("en");
    expect(t.measured!.tds).toBe(1.38);
    expect(t.measured!.yield).toEqual({ value: 258, unit: "gram" });
  });

  test("recipe_ref resolves by exact id", () => {
    expect(normalize(doc).tastings[0]!.recipe!.title).toBe("Roaster's V60");
  });

  // The substitution case: the tasting's own bean_ref wins over the bean the
  // recipe it points at is for. Rendering the recipe's bean here would report
  // the wrong coffee for the cup that was actually drunk.
  test("the tasting's own bean_ref beats the referenced recipe's", () => {
    const t = normalize(doc).tastings[0]!;
    expect(t.bean!.name).toBe("Las Brisas");
    expect(t.recipe!.bean!.name).toBe("Nano Challa");
  });

  test("a single co-located bean associates a tasting that names none", () => {
    const bagToBrew = {
      ...doc,
      beans: [doc.beans[0]],
      tastings: [{ recipe_ref: "roasters-v60" }],
    };
    expect(normalize(bagToBrew).tastings[0]!.bean!.name).toBe("Nano Challa");
  });

  test("several beans and no bean_ref associates nothing", () => {
    const t = normalize({ ...doc, tastings: [{ recipe_ref: "roasters-v60" }] })
      .tastings[0]!;
    expect(t.bean).toBeNull();
  });

  // Co-location triggers on a single BEAN and associates a coffee. There is no
  // recipe-side counterpart, so a tasting that names no recipe names no recipe
  // however few the document carries.
  test("no recipe_ref means no recipe, even with one recipe in the document", () => {
    const one = {
      ...doc,
      recipes: [doc.recipes[0]],
      tastings: [{ rating: 5 }],
    };
    expect(normalize(one).tastings[0]!.recipe).toBeNull();
  });

  test("an unresolved recipe_ref leaves the tasting unlinked rather than failing", () => {
    const t = normalize({ ...doc, tastings: [{ recipe_ref: "nope" }] })
      .tastings[0]!;
    expect(t.recipe).toBeNull();
  });

  test("a perceived or measured object that states nothing reads as absent", () => {
    const t = normalize({ ...doc, tastings: [{ perceived: {}, measured: {} }] })
      .tastings[0]!;
    expect(t.perceived).toBeNull();
    expect(t.measured).toBeNull();
  });

  test("junk in the tastings array never throws", () => {
    for (const v of [null, 42, "x", [1], { tastings: 7 }])
      expect(() => normalize({ coffeejson: "1.0", tastings: v })).not.toThrow();
    expect(
      normalize({ coffeejson: "1.0", tastings: [1, "x", null, {}] }).tastings,
    ).toHaveLength(1);
  });
});

// Extraction yield is deliberately not a wire field — two homes for one quantity
// can disagree — so this derivation is what keeps consumers agreeing.
describe("derived extraction yield", () => {
  const doc = (
    tasting: Record<string, unknown>,
    recipe: Record<string, unknown> = {},
  ) => ({
    coffeejson: "1.0",
    recipes: [
      {
        id: "r",
        title: "R",
        coffee: { value: 18, unit: "gram" },
        water: { value: 300, unit: "gram" },
        ...recipe,
      },
    ],
    tastings: [{ recipe_ref: "r", ...tasting }],
  });
  const ey = (t: Record<string, unknown>, r?: Record<string, unknown>) =>
    normalize(doc(t, r)).tastings[0]!.extractionYield;

  test("(beverage mass x tds) / dose, from the recipe's target yield", () => {
    // 262 g x 1.38 % / 18 g = 20.0867 %, the spec's own worked example.
    expect(
      ey({ measured: { tds: 1.38 } }, { yield: { value: 262, unit: "gram" } }),
    ).toBeCloseTo(20.0867, 3);
  });

  test("the weighed beverage beats the recipe's target", () => {
    // 258 g actually in the cup, not the 262 g it was aimed at.
    expect(
      ey(
        { measured: { tds: 1.38, yield: { value: 258, unit: "gram" } } },
        { yield: { value: 262, unit: "gram" } },
      ),
    ).toBeCloseTo(19.78, 2);
  });

  test("an immersion recipe with no target yield still derives, given a weighed cup", () => {
    // The case `measured.yield` exists for: an immersion recipe stated by water
    // carries no target yield, so nothing else supplies the beverage mass.
    expect(
      ey({ measured: { tds: 1.31, yield: { value: 431, unit: "gram" } } }),
    ).toBeCloseTo(31.3672, 3);
  });

  test("mixed mass units convert before dividing", () => {
    const gramBased = ey({
      measured: { tds: 1.4, yield: { value: 250, unit: "gram" } },
    });
    const ounceBased = ey({
      measured: {
        tds: 1.4,
        yield: { value: 250 / 28.349523125, unit: "ounce" },
      },
    });
    expect(ounceBased).toBeCloseTo(gramBased!, 6);
  });

  test("a missing input derives nothing rather than guessing", () => {
    expect(ey({ rating: 4 })).toBeNull(); // no tds
    expect(ey({ measured: { tds: 1.38 } })).toBeNull(); // no beverage mass
    expect(
      normalize({ coffeejson: "1.0", tastings: [{ measured: { tds: 1.4 } }] })
        .tastings[0]!.extractionYield,
    ).toBeNull(); // no recipe, so no dose
  });

  test("a windowed beverage mass takes its midpoint, as the espresso ratio does", () => {
    // 33 g midpoint x 9 % / 18 g = 16.5
    expect(
      ey({ measured: { tds: 9, yield: { min: 32, max: 34, unit: "gram" } } }),
    ).toBeCloseTo(16.5, 6);
  });

  test("a dose in a unit no mass converts into derives nothing", () => {
    expect(
      ey(
        { measured: { tds: 1.4, yield: { value: 250, unit: "gram" } } },
        { coffee: { value: 18, unit: "milliliter" } },
      ),
    ).toBeNull();
  });

  test("junk inputs never throw and never produce a number", () => {
    for (const v of [0, -1, "x", null, Infinity, NaN])
      expect(
        ey({ measured: { tds: v, yield: { value: 250, unit: "gram" } } }),
      ).toBeNull();
  });
});

describe("duplicate ids leave every reference to them unresolved", () => {
  test("two beans sharing an id: a bean_ref to it resolves to no bean", () => {
    const n = normalize({
      coffeejson: "1.0",
      beans: [
        { id: "dup", name: "First" },
        { id: "dup", name: "Second" },
      ],
      recipes: [
        {
          title: "t",
          bean_ref: "dup",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
      ],
      tastings: [{ bean_ref: "dup", rating: 4 }],
    });
    expect(n.recipes[0]!.bean).toBeNull();
    expect(n.tastings[0]!.bean).toBeNull();
  });

  test("two recipes sharing an id: a recipe_ref to it resolves to no recipe", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          id: "dup",
          title: "First",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
        {
          id: "dup",
          title: "Second",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
      ],
      tastings: [{ recipe_ref: "dup", rating: 4 }],
    });
    expect(n.tastings[0]!.recipe).toBeNull();
  });

  test("two tastings sharing an id: both are carried, and each resolves its own references", () => {
    const n = normalize({
      coffeejson: "1.0",
      beans: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      recipes: [
        {
          id: "r",
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
      ],
      tastings: [
        { id: "dup", recipe_ref: "r", bean_ref: "a", rating: 4 },
        { id: "dup", recipe_ref: "r", bean_ref: "b", rating: 3 },
      ],
    });
    expect(n.tastings.map((t) => t.bean!.name)).toEqual(["A", "B"]);
    expect(n.tastings.every((t) => t.recipe!.id === "r")).toBe(true);
  });

  test("one match still resolves, and no match still resolves to nothing", () => {
    const doc = (ref: string) =>
      normalize({
        coffeejson: "1.0",
        beans: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        recipes: [
          {
            title: "t",
            bean_ref: ref,
            coffee: { value: 15, unit: "gram" },
            water: { value: 250, unit: "gram" },
          },
        ],
      });
    expect(doc("a").recipes[0]!.bean!.name).toBe("A");
    expect(doc("zzz").recipes[0]!.bean).toBeNull();
  });

  test("a tasting with no recipe_ref names no recipe, even in a one-recipe document", () => {
    const n = normalize({
      coffeejson: "1.0",
      recipes: [
        {
          id: "r",
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
      ],
      tastings: [{ rating: 4 }],
    });
    expect(n.tastings[0]!.recipe).toBeNull();
  });
});

describe("ratio derivation brings both operands to one mass unit", () => {
  const r = (extra: object) =>
    normalize({ coffeejson: "1.0", recipes: [{ title: "t", ...extra }] })
      .recipes[0]!;

  test("a gram dose against an ounce water converts before dividing", () => {
    expect(
      r({
        coffee: { value: 15, unit: "gram" },
        water: { value: 8, unit: "ounce" },
      }).ratio,
    ).toBeCloseTo((8 * 28.349523125) / 15, 6);
  });

  test("espresso converts too: a gram dose against an ounce yield", () => {
    expect(
      r({
        basis: "yield",
        coffee: { value: 18, unit: "gram" },
        yield: { value: 1.27, unit: "ounce" },
      }).ratio,
    ).toBeCloseTo((1.27 * 28.349523125) / 18, 6);
  });

  test("one unit is as good as two: ounce over ounce needs no conversion", () => {
    expect(
      r({
        coffee: { value: 0.5, unit: "ounce" },
        water: { value: 7.5, unit: "ounce" },
      }).ratio,
    ).toBe(15);
  });

  test("a unit with no mass conversion on either side derives no ratio", () => {
    expect(
      r({
        coffee: { value: 15, unit: "gram" },
        water: { value: 0.25, unit: "liter" },
      }).ratio,
    ).toBeNull();
    expect(
      r({
        coffee: { value: 0.015, unit: "liter" },
        water: { value: 250, unit: "gram" },
      }).ratio,
    ).toBeNull();
    expect(
      r({
        basis: "yield",
        coffee: { value: 18, unit: "celsius" },
        yield: { value: 36, unit: "gram" },
      }).ratio,
    ).toBeNull();
    expect(
      r({
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "milliliter" },
      }).ratio,
    ).toBeNull();
  });

  test("a window on one side still derives, from its midpoint", () => {
    expect(
      r({
        coffee: { min: 18, max: 20, unit: "gram" },
        water: { value: 285, unit: "gram" },
      }).ratio,
    ).toBe(15);
    expect(
      r({
        coffee: { value: 19, unit: "gram" },
        water: { min: 9, max: 11, unit: "ounce" },
      }).ratio,
    ).toBeCloseTo((10 * 28.349523125) / 19, 6);
  });

  test("a dose in a unit with no mass conversion derives no water from a ratio", () => {
    expect(
      r({ coffee: { value: 0.02, unit: "liter" }, ratio: 15 }).water,
    ).toBeNull();
  });
});

describe("an origin item projects every fact the schema gives it", () => {
  const item = (it: object) =>
    normalize({
      coffeejson: "1.0",
      beans: [{ name: "b", origin: { items: [it] } }],
    }).beans[0]!.originItems[0]!;

  test("producers, altitude, varietals and harvest time all reach the view model", () => {
    expect(
      item({
        name: "Finca X",
        country: "CO",
        region: "Huila",
        producers: [
          { name: "Elias Roa", role: "farm" },
          { name: "Coop Huila" },
        ],
        altitude: { min: 1700, max: 1900, unit: "meter" },
        varietals: ["Caturra", "Bourbon"],
        process: ["washed"],
        harvest_time: "Oct–Dec 2024",
        percentage: 60,
      }),
    ).toEqual({
      name: "Finca X",
      country: "CO",
      region: "Huila",
      producers: [
        { name: "Elias Roa", role: "farm", url: null, type: null },
        { name: "Coop Huila", role: null, url: null, type: null },
      ],
      altitude: { min: 1700, max: 1900, unit: "meter" },
      varietals: ["Caturra", "Bourbon"],
      process: ["washed"],
      harvestTime: "Oct–Dec 2024",
      percentage: 60,
    });
  });

  test("a party with an unrecognized role is carried, role and all", () => {
    expect(
      item({ producers: [{ name: "Someone", role: "cup-taster" }] }).producers,
    ).toEqual([{ name: "Someone", role: "cup-taster", url: null, type: null }]);
  });

  test("a party with no usable name states nothing", () => {
    expect(
      item({
        producers: [
          { role: "farm" },
          { name: "   " },
          "Elias",
          { name: "Real" },
        ],
      }).producers,
    ).toEqual([{ name: "Real", role: null, url: null, type: null }]);
  });

  test("an item stating none of them reads as empty, never as holes", () => {
    expect(item({ country: "ET" })).toEqual({
      name: null,
      country: "ET",
      region: null,
      producers: [],
      altitude: null,
      varietals: [],
      process: [],
      harvestTime: null,
      percentage: null,
    });
  });

  test("an altitude missing its unit or its magnitude states nothing", () => {
    expect(item({ altitude: { value: 1800 } }).altitude).toBeNull();
    expect(item({ altitude: { unit: "meter" } }).altitude).toBeNull();
  });
});

describe("the measurements are authoritative, the stated ratio a convenience", () => {
  test("a stated ratio its own coffee and water contradict is recomputed", () => {
    const n = normalize(
      load("fixtures/valid/recipe-ratio-disagrees-with-water.json"),
    );
    expect(n.recipes[0]!.ratio).toBe(15);
  });

  test("a stated ratio stands where the measurements state none", () => {
    const r = (extra: object) =>
      normalize({
        coffeejson: "1.0",
        recipes: [{ title: "t", ratio: 16.7, ...extra }],
      }).recipes[0]!;
    expect(r({ coffee: { value: 20, unit: "gram" } }).ratio).toBe(16.7);
    expect(r({ water: { value: 300, unit: "gram" } }).ratio).toBe(16.7);
    // A volume water states no mass ratio, so it does not displace the stated one.
    expect(
      r({
        coffee: { value: 20, unit: "gram" },
        water: { value: 300, unit: "milliliter" },
      }).ratio,
    ).toBe(16.7);
  });
});

describe("an unrecognized basis is derived from the quantities present", () => {
  const r = (extra: object) =>
    normalize({ coffeejson: "1.0", recipes: [{ title: "t", ...extra }] })
      .recipes[0]!;
  const dose = { value: 18, unit: "gram" };

  test("water or ratio present reads as water-basis, whatever the token says", () => {
    expect(
      r({
        basis: "espresso",
        coffee: dose,
        water: { value: 270, unit: "gram" },
      }).isEspresso,
    ).toBe(false);
    expect(r({ basis: "espresso", coffee: dose, ratio: 15 }).isEspresso).toBe(
      false,
    );
    // Even beside a yield: a water-basis recipe MAY also state the beverage out.
    expect(
      r({
        basis: "espresso",
        coffee: dose,
        water: { value: 270, unit: "gram" },
        yield: { value: 250, unit: "gram" },
      }).isEspresso,
    ).toBe(false);
  });

  test("only a yield reads as yield-basis", () => {
    expect(
      r({ basis: "espresso", coffee: dose, yield: { value: 36, unit: "gram" } })
        .isEspresso,
    ).toBe(true);
  });

  test("the switch is `basis`, not `method`: a stated basis is never derived over", () => {
    expect(
      r({
        basis: "yield",
        method: "pour_over",
        coffee: dose,
        yield: { value: 36, unit: "gram" },
      }).isEspresso,
    ).toBe(true);
    expect(
      r({
        basis: "water",
        method: "espresso",
        coffee: dose,
        yield: { value: 36, unit: "gram" },
      }).isEspresso,
    ).toBe(false);
    expect(
      r({
        method: "espresso",
        coffee: dose,
        water: { value: 270, unit: "gram" },
      }).isEspresso,
    ).toBe(false);
  });

  test("a recipe stating no quantity at all falls back to its method", () => {
    expect(r({ method: "espresso", coffee: dose }).isEspresso).toBe(true);
    expect(r({ method: "pour_over", coffee: dose }).isEspresso).toBe(false);
  });
});

// A date-only member states a day. A string shaped like one that names no day
// on the Gregorian calendar states nothing, and a projection carries nothing.
describe("calendar dates", () => {
  const roastDateOf = (roast_date: unknown) =>
    normalize({
      coffeejson: "1.0",
      beans: [{ name: "Nano Challa", roast_date }],
    }).beans[0]!.roastDate;
  test("a real day travels", () => {
    expect(roastDateOf("2026-06-01")).toBe("2026-06-01");
    expect(roastDateOf("2024-02-29")).toBe("2024-02-29");
  });
  test("a day the calendar does not have is absent", () => {
    expect(roastDateOf("2026-02-31")).toBeNull();
    expect(roastDateOf("2026-13-01")).toBeNull();
    expect(roastDateOf("2026-00-10")).toBeNull();
    expect(roastDateOf("2025-02-29")).toBeNull();
  });
  test("a shape that is not a date is absent", () => {
    expect(roastDateOf("2026-06")).toBeNull();
    expect(roastDateOf("2026-06-01T09:00:00Z")).toBeNull();
    expect(roastDateOf("June 2026")).toBeNull();
    expect(roastDateOf(20260601)).toBeNull();
  });
});

// A page that credits a transcription needs the recipe's own provenance, and
// reading it off the wire beside a normalized view is how one rule comes to
// have two implementations.
describe("a recipe's provenance", () => {
  const recipeOf = (extra: Record<string, unknown>) =>
    normalize({ coffeejson: "1.0", recipes: [{ title: "V60", ...extra }] })
      .recipes[0]!;
  test("author, source, description, language and date project", () => {
    const r = recipeOf({
      author: {
        name: "Example Roastery",
        type: "organization",
        role: "roaster",
        url: "https://roastery.example",
      },
      based_on: "https://roastery.example/v60",
      description: "The house pour-over.",
      lang: "en",
      date_published: "2026-06-01",
    });
    expect(r.author).toEqual({
      name: "Example Roastery",
      role: "roaster",
      url: "https://roastery.example",
      type: "organization",
    });
    expect(r.basedOn).toBe("https://roastery.example/v60");
    expect(r.description).toBe("The house pour-over.");
    expect(r.lang).toBe("en");
    expect(r.datePublished).toBe("2026-06-01");
  });
  test("an author naming nobody credits nobody", () => {
    expect(recipeOf({ author: { role: "roaster" } }).author).toBeNull();
    expect(recipeOf({}).author).toBeNull();
  });
  test("a published date the calendar does not have is absent", () => {
    expect(recipeOf({ date_published: "2026-02-31" }).datePublished).toBeNull();
  });
});
