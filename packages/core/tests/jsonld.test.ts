import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { beanJsonLd, recipeJsonLd } from "../src/jsonld";
import type { CoffeeJSONDocument } from "../src/types";

// The documented full example (design sample): every mapped field at once.
const FULL: CoffeeJSONDocument = {
  coffeejson: "1.0",
  beans: [
    {
      name: "Nano Challa",
      roaster: {
        name: "Example Roastery",
        url: "https://example-roastery.com",
        type: "organization",
      },
    },
  ],
  recipes: [
    {
      title: "Sunday V60",
      description:
        "A relaxed 15 g weekend pour-over — bright, sweet, and forgiving.",
      method: "pour_over",
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
      brewer: {
        id: "hario-v60",
        brand: "Hario",
        model: "V60",
        label: "Hario V60",
      },
      steps: [
        { kind: "prep", instruction: "rinse filter, preheat dripper" },
        { kind: "stir", instruction: "swirl gently" },
        { at_s: 0, to_water: { value: 150, unit: "gram" } },
        { at_s: 60, to_water: { value: 250, unit: "gram" } },
      ],
      finish_s: 150,
      lang: "en",
      author: {
        name: "Example Roastery",
        url: "https://example.com",
        type: "organization",
      },
      based_on: "https://example.com/brew-guides/sunday-v60",
      images: ["https://example.com/img/sunday-v60-16x9.jpg"],
      date_published: "2026-06-01",
    },
  ],
};

test("the full mapping — every documented field lands on its schema.org slot", () => {
  expect(
    recipeJsonLd(FULL, 0, { url: "https://coffeejson.org/r?d=abc" }),
  ).toEqual({
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Sunday V60",
    url: "https://coffeejson.org/r?d=abc",
    description:
      "A relaxed 15 g weekend pour-over — bright, sweet, and forgiving.",
    image: ["https://example.com/img/sunday-v60-16x9.jpg"],
    author: {
      "@type": "Organization",
      name: "Example Roastery",
      url: "https://example.com",
    },
    isBasedOn: "https://example.com/brew-guides/sunday-v60",
    datePublished: "2026-06-01",
    inLanguage: "en",
    performTime: "PT150S",
    recipeIngredient: [
      "15 g coffee — Nano Challa (Example Roastery)",
      "250 g water",
    ],
    recipeInstructions: [
      { "@type": "HowToStep", text: "rinse filter, preheat dripper" },
      { "@type": "HowToStep", text: "swirl gently" },
      { "@type": "HowToStep", text: "Pour to 150 g" },
      { "@type": "HowToStep", text: "Pour to 250 g" },
    ],
    tool: [{ "@type": "HowToTool", name: "Hario V60" }],
  });
});

test("a minimal recipe exports exactly the members it carries — nothing fabricated", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [
      {
        title: "Plain",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
      },
    ],
  };
  // Exact equality pins the absences, aggregateRating and nutrition included.
  expect(recipeJsonLd(doc, 0)).toEqual({
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Plain",
    recipeIngredient: ["15 g coffee", "250 g water"],
  });
});

test("no images in the document means no image member — an empty array too", () => {
  const doc = (images?: string[]): CoffeeJSONDocument => ({
    coffeejson: "1.0",
    recipes: [
      {
        title: "x",
        coffee: { value: 15, unit: "gram" },
        ...(images ? { images } : {}),
      },
    ],
  });
  expect(recipeJsonLd(doc(), 0)).not.toHaveProperty("image");
  expect(recipeJsonLd(doc([]), 0)).not.toHaveProperty("image");
  expect(recipeJsonLd(doc(["https://example.com/a.jpg"]), 0)).toHaveProperty(
    "image",
    ["https://example.com/a.jpg"],
  );
});

test("author defaults to Person when type is absent; a nameless author is omitted", () => {
  const doc = (author: object): CoffeeJSONDocument => ({
    coffeejson: "1.0",
    recipes: [
      { title: "x", coffee: { value: 15, unit: "gram" }, author } as never,
    ],
  });
  expect(recipeJsonLd(doc({ name: "James Hoffmann" }), 0)).toHaveProperty(
    "author",
    {
      "@type": "Person",
      name: "James Hoffmann",
    },
  );
  expect(
    recipeJsonLd(doc({ url: "https://example.com" }), 0),
  ).not.toHaveProperty("author");
});

test("a yield-basis espresso exports recipeYield and no water ingredient", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [
      {
        title: "Shot",
        method: "espresso",
        basis: "yield",
        coffee: { value: 18, unit: "gram" },
        yield: { value: 36, unit: "gram" },
      },
    ],
  };
  const ld = recipeJsonLd(doc, 0)!;
  expect(ld["recipeYield"]).toBe("36 g");
  expect(ld["recipeIngredient"]).toEqual(["18 g coffee"]);
});

test("additions become ingredients — open registry types verbatim, note in parens", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [
      {
        title: "Iced",
        coffee: { value: 20, unit: "gram" },
        water: { value: 150, unit: "gram" },
        additions: [
          { type: "ice", amount: { value: 120, unit: "gram" } },
          { type: "milk", amount: { value: 100, unit: "gram" }, note: "oat" },
          { type: "ice", note: "to taste" },
        ],
      },
    ],
  };
  expect(recipeJsonLd(doc, 0)!["recipeIngredient"]).toEqual([
    "20 g coffee",
    "150 g water",
    "120 g ice",
    "100 g milk (oat)",
    // Unquantified on purpose: the type alone, never an invented quantity.
    "ice (to taste)",
  ]);
});

test("bean association: bean_ref resolves exactly; multi-bean without a ref stays unlinked", () => {
  const beans = [
    { id: "a", name: "First", roaster: { name: "R1" } },
    { id: "b", name: "Second" },
  ];
  const recipe = { title: "x", coffee: { value: 15, unit: "gram" } };
  const withRef: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans,
    recipes: [{ ...recipe, bean_ref: "b" }],
  };
  expect(recipeJsonLd(withRef, 0)!["recipeIngredient"]).toEqual([
    "15 g coffee — Second",
  ]);
  const unlinked: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans,
    recipes: [recipe],
  };
  expect(recipeJsonLd(unlinked, 0)!["recipeIngredient"]).toEqual([
    "15 g coffee",
  ]);
});

test("a step with an author-customized label carries it as the HowToStep name", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [
      {
        title: "x",
        coffee: { value: 15, unit: "gram" },
        steps: [
          {
            at_s: 0,
            to_water: { value: 60, unit: "gram" },
            label: "Bloom",
            instruction: "wet the grounds",
          },
          { kind: "stir" }, // nothing human to say — skipped, never fabricated
        ],
      },
    ],
  };
  expect(recipeJsonLd(doc, 0)!["recipeInstructions"]).toEqual([
    { "@type": "HowToStep", name: "Bloom", text: "wet the grounds" },
  ]);
});

test("gear maps to HowToTool: brewer, basket, and the grinder, label-or-brand/model", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [
      {
        title: "x",
        coffee: { value: 18, unit: "gram" },
        brewer: { id: "custom", label: "Hario V60" },
        basket: { id: "vst-18g", brand: "VST", model: "18 g" },
        grind: {
          grinder: { id: "custom", brand: "Comandante", model: "C40" },
          setting: "22 clicks",
        },
      },
    ],
  };
  expect(recipeJsonLd(doc, 0)!["tool"]).toEqual([
    { "@type": "HowToTool", name: "Hario V60" },
    { "@type": "HowToTool", name: "VST 18 g" },
    { "@type": "HowToTool", name: "Comandante C40" },
  ]);
});

test("unexportable inputs return null: no recipe at the index, or no usable title", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [{ title: "  ", coffee: { value: 15, unit: "gram" } } as never],
  };
  expect(recipeJsonLd(doc, 0)).toBeNull();
  expect(recipeJsonLd(doc, 5)).toBeNull();
  expect(recipeJsonLd({ coffeejson: "1.0" }, 0)).toBeNull();
});

const root = fileURLToPath(new URL("../../..", import.meta.url));
const docsIn = (dir: string): [string, CoffeeJSONDocument][] =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".json") && f !== "catalog.json")
    .map((f) => [
      join(dir, f),
      JSON.parse(readFileSync(join(root, dir, f), "utf8")),
    ]);

const NEVER_FABRICATED = [
  "aggregateRating",
  "nutrition",
  "prepTime",
  "cookTime",
  "totalTime",
  "recipeCuisine",
  "recipeCategory",
  "keywords",
  "video",
];

test("every corpus recipe exports valid, honest JSON-LD", () => {
  for (const [name, doc] of [
    ...docsIn("fixtures/valid"),
    ...docsIn("recipes"),
  ]) {
    (doc.recipes ?? []).forEach((_, i) => {
      const ld = recipeJsonLd(doc, i);
      expect(ld, `${name}[${i}]`).not.toBeNull();
      expect(ld!["@type"], name).toBe("Recipe");
      expect(typeof ld!["name"], name).toBe("string");
      for (const key of NEVER_FABRICATED)
        expect(ld, `${name} fabricated ${key}`).not.toHaveProperty(key);
    });
  }
});

test("every corpus recipe with an author exports it — attribution reaches the structured data", () => {
  for (const [name, doc] of docsIn("recipes")) {
    (doc.recipes ?? []).forEach(
      (r: { author?: { name?: string } }, i: number) => {
        if (!r.author?.name) return;
        const ld = recipeJsonLd(doc, i)!;
        expect((ld["author"] as { name?: string })?.name, name).toBe(
          r.author.name,
        );
      },
    );
  }
});

// A recipe whose water is a volume still exports the water as an ingredient.
const VOLUME_WATER: CoffeeJSONDocument = {
  coffeejson: "1.0",
  recipes: [
    {
      title: "Volume water",
      method: "pour_over",
      coffee: { value: 20, unit: "gram" },
      water: { value: 320, unit: "milliliter" },
    },
  ],
};

test("a volume water exports as a recipeIngredient", () => {
  expect(recipeJsonLd(VOLUME_WATER, 0)?.["recipeIngredient"]).toEqual([
    "20 g coffee",
    "320 mL water",
  ]);
});

// `decodePayload` casts unchecked past the version gate, so this must be total
// over any JSON value.
test("any document or recipe member may be garbage without throwing", () => {
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
  ];
  for (const v of BATTERY) expect(() => recipeJsonLd(v, 0)).not.toThrow();
  for (const field of ["beans", "recipes", "generator"])
    for (const v of BATTERY)
      expect(
        () =>
          recipeJsonLd(
            { coffeejson: "1.0", beans: [], recipes: [], [field]: v },
            0,
          ),
        field,
      ).not.toThrow();
  for (const field of [
    "title",
    "coffee",
    "water",
    "yield",
    "steps",
    "additions",
    "images",
    "author",
    "finish_s",
    "bean_ref",
    "grind",
    "brewer",
  ])
    for (const v of BATTERY) {
      const doc = {
        coffeejson: "1.0",
        recipes: [
          { title: "T", coffee: { value: 15, unit: "gram" }, [field]: v },
        ],
      };
      expect(() => recipeJsonLd(doc, 0), field).not.toThrow();
    }
});

// A non-numeric finish_s is never interpolated into the ISO 8601 duration.
test("a non-numeric finish_s exports no performTime rather than a malformed duration", () => {
  for (const bad of [{ a: 1 }, "90", true, [], null, NaN, Infinity]) {
    const ld = recipeJsonLd(
      {
        coffeejson: "1.0",
        recipes: [
          { title: "T", coffee: { value: 15, unit: "gram" }, finish_s: bad },
        ],
      },
      0,
    );
    expect(ld, String(bad)).not.toHaveProperty("performTime");
  }
  // A real number still exports, including zero.
  expect(
    recipeJsonLd(
      {
        coffeejson: "1.0",
        recipes: [
          { title: "T", coffee: { value: 15, unit: "gram" }, finish_s: 0 },
        ],
      },
      0,
    ),
  ).toHaveProperty("performTime", "PT0S");
});

// A non-array `beans`.
test("a non-array beans leaves the recipe unlinked rather than throwing", () => {
  const ld = recipeJsonLd(
    {
      coffeejson: "1.0",
      beans: { not: "an array" },
      recipes: [
        { title: "T", coffee: { value: 15, unit: "gram" }, bean_ref: "x" },
      ],
    },
    0,
  );
  expect(ld?.["recipeIngredient"]).toEqual(["15 g coffee"]);
});

// The exporter reads the same date-only rule the projection does: a string
// shaped like a day that the calendar does not have asserts nothing.
test("datePublished names a real day or is absent", () => {
  const withDate = (date_published: string) =>
    recipeJsonLd(
      {
        coffeejson: "1.0",
        recipes: [{ title: "Everyday V60", date_published }],
      },
      0,
    );
  expect(withDate("2026-06-01")?.["datePublished"]).toBe("2026-06-01");
  expect(withDate("2026-02-31")?.["datePublished"]).toBeUndefined();
  expect(withDate("2026-06-01T09:00:00Z")?.["datePublished"]).toBeUndefined();
});

// ---------------------------------------------------------------------------
// beanJsonLd — schema.org Product, no offer. A bean is a coffee a roaster sells;
// the price, stock and lot live in the roaster's own listing, never here.

const FULL_BEAN: CoffeeJSONDocument = {
  coffeejson: "1.0",
  beans: [
    {
      name: "Nano Challa",
      roaster: {
        name: "Example Roastery",
        url: "https://example-roastery.com",
        type: "organization",
      },
      url: "https://example-roastery.com/products/nano-challa",
      images: ["https://example-roastery.com/img/nano-challa.jpg"],
      origin: {
        type: "single",
        items: [
          {
            country: "ET",
            region: "Jimma",
            producers: [
              { name: "Nano Challa Cooperative", role: "cooperative" },
            ],
            altitude: { min: 1900, max: 2100, unit: "meter" },
            harvest_time: "Nov–Jan 2025",
          },
        ],
      },
      process: ["washed"],
      drying_method: "raised_bed",
      varietals: ["Heirloom"],
      roast_level: "light",
      roast_agtron: 72,
      roast_date: "2026-06-20",
      rest_days: { min: 7, max: 21 },
      production_roaster: "Loring S15",
      decaf: false,
      form: "bean",
      preferred_extraction: "filter",
      certifications: ["organic"],
      roaster_notes: ["jasmine", "bergamot", "honey"],
      description: "A washed Jimma lot from the Nano Challa cooperative.",
      lang: "en",
    },
  ],
};

test("the full bean mapping — every documented field lands on its schema.org slot", () => {
  expect(
    beanJsonLd(FULL_BEAN, 0, {
      url: "https://coffeejson.org/beans/example-nano-challa/",
    }),
  ).toEqual({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Nano Challa",
    url: "https://coffeejson.org/beans/example-nano-challa/",
    sameAs: "https://example-roastery.com/products/nano-challa",
    description: "A washed Jimma lot from the Nano Challa cooperative.",
    image: ["https://example-roastery.com/img/nano-challa.jpg"],
    brand: {
      "@type": "Organization",
      name: "Example Roastery",
      url: "https://example-roastery.com",
    },
    countryOfOrigin: { "@type": "Country", identifier: "ET" },
    productionDate: "2026-06-20",
    additionalProperty: [
      { "@type": "PropertyValue", name: "region", value: "Jimma" },
      {
        "@type": "PropertyValue",
        name: "producer",
        value: "Nano Challa Cooperative",
      },
      {
        "@type": "PropertyValue",
        name: "altitude",
        minValue: 1900,
        maxValue: 2100,
        unitCode: "MTR",
      },
      { "@type": "PropertyValue", name: "harvest_time", value: "Nov–Jan 2025" },
      { "@type": "PropertyValue", name: "process", value: ["washed"] },
      { "@type": "PropertyValue", name: "drying_method", value: "raised_bed" },
      { "@type": "PropertyValue", name: "varietals", value: ["Heirloom"] },
      { "@type": "PropertyValue", name: "roast_level", value: "light" },
      { "@type": "PropertyValue", name: "roast_agtron", value: 72 },
      {
        "@type": "PropertyValue",
        name: "rest_days",
        minValue: 7,
        maxValue: 21,
        unitText: "day",
      },
      {
        "@type": "PropertyValue",
        name: "production_roaster",
        value: "Loring S15",
      },
      { "@type": "PropertyValue", name: "decaf", value: false },
      { "@type": "PropertyValue", name: "form", value: "bean" },
      {
        "@type": "PropertyValue",
        name: "preferred_extraction",
        value: "filter",
      },
      { "@type": "PropertyValue", name: "certifications", value: ["organic"] },
      {
        "@type": "PropertyValue",
        name: "roaster_notes",
        value: ["jasmine", "bergamot", "honey"],
      },
    ],
  });
});

test("a minimal bean exports exactly the members it carries — no offer, nothing fabricated", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [{ name: "Plain" }],
  };
  expect(beanJsonLd(doc, 0)).toEqual({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Plain",
  });
  expect(beanJsonLd(doc, 0)).not.toHaveProperty("offers");
});

test("a bean without a usable name, or no bean at that index, exports null", () => {
  expect(
    beanJsonLd({ coffeejson: "1.0", beans: [{ roaster: { name: "R" } }] }, 0),
  ).toBeNull();
  expect(
    beanJsonLd({ coffeejson: "1.0", beans: [{ name: "  " }] }, 0),
  ).toBeNull();
  expect(beanJsonLd({ coffeejson: "1.0", beans: [] }, 0)).toBeNull();
  expect(beanJsonLd("not a document", 0)).toBeNull();
});

test("the roaster's page is the page: sameAs is omitted when it equals url", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [{ name: "x", url: "https://example-roastery.com/products/x" }],
  };
  expect(
    beanJsonLd(doc, 0, { url: "https://example-roastery.com/products/x" }),
  ).toEqual({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "x",
    url: "https://example-roastery.com/products/x",
  });
  expect(beanJsonLd(doc, 0)).toHaveProperty(
    "sameAs",
    "https://example-roastery.com/products/x",
  );
});

test("a blend exports every country and, absent a stated process, no per-lot properties", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "Blend",
        origin: {
          type: "blend",
          items: [
            {
              country: "CO",
              region: "Huila",
              altitude: { value: 1800, unit: "meter" },
              percentage: 60,
            },
            { country: "ET", region: "Guji", percentage: 40 },
            { country: "CO", region: "Nariño" },
          ],
        },
      },
    ],
  };
  const ld = beanJsonLd(doc, 0)!;
  expect(ld["countryOfOrigin"]).toEqual([
    { "@type": "Country", identifier: "CO" },
    { "@type": "Country", identifier: "ET" },
  ]);
  expect(ld).not.toHaveProperty("additionalProperty");
});

test("a single origin with two lots exports its country once and no lot properties", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "x",
        origin: {
          type: "single",
          items: [
            { country: "BR", region: "a" },
            { country: "BR", region: "b" },
          ],
        },
      },
    ],
  };
  const ld = beanJsonLd(doc, 0)!;
  expect(ld["countryOfOrigin"]).toEqual({
    "@type": "Country",
    identifier: "BR",
  });
  expect(ld).not.toHaveProperty("additionalProperty");
});

test("a single lot may state process and varietals on the lot — one lot is the bag", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "Yirgacheffe",
        origin: {
          items: [
            { country: "ET", process: ["washed"], varietals: ["Heirloom"] },
          ],
        },
      },
    ],
  };
  expect(beanJsonLd(doc, 0)!["additionalProperty"]).toEqual([
    { "@type": "PropertyValue", name: "process", value: ["washed"] },
    { "@type": "PropertyValue", name: "varietals", value: ["Heirloom"] },
  ]);
});

test("a bean-level process wins over the lot's — the bag's own claim is not overridden", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "x",
        process: ["natural"],
        varietals: ["Bourbon"],
        origin: {
          items: [
            { country: "BR", process: ["washed"], varietals: ["Catuaí"] },
          ],
        },
      },
    ],
  };
  expect(beanJsonLd(doc, 0)!["additionalProperty"]).toEqual([
    { "@type": "PropertyValue", name: "process", value: ["natural"] },
    { "@type": "PropertyValue", name: "varietals", value: ["Bourbon"] },
  ]);
});

test("a blend unions its lots' processes — the bag contains coffee of each", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "Sermon",
        origin: {
          type: "blend",
          items: [
            { country: "ET", process: ["washed"] },
            { country: "CO", process: ["natural"] },
            { country: "CO", process: ["washed"] },
          ],
        },
      },
    ],
  };
  expect(beanJsonLd(doc, 0)!["additionalProperty"]).toEqual([
    { "@type": "PropertyValue", name: "process", value: ["washed", "natural"] },
  ]);
});

test("a blend does NOT union its lots' varietals — nine varietals across three lots is not a bag fact", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "Rudder",
        origin: {
          type: "blend",
          items: [
            { country: "ET", varietals: ["Heirloom"] },
            { country: "BR", varietals: ["Yellow Bourbon"] },
          ],
        },
      },
    ],
  };
  expect(beanJsonLd(doc, 0)).not.toHaveProperty("additionalProperty");
});

test("a blend's bean-level process is left alone — no union runs when the bag states one", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "x",
        process: ["honey"],
        origin: {
          type: "blend",
          items: [
            { country: "ET", process: ["washed"] },
            { country: "CO", process: ["natural"] },
          ],
        },
      },
    ],
  };
  expect(beanJsonLd(doc, 0)!["additionalProperty"]).toEqual([
    { "@type": "PropertyValue", name: "process", value: ["honey"] },
  ]);
});

test("altitude in feet carries the UN/CEFACT code, a single value exports as value", () => {
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    beans: [
      {
        name: "x",
        origin: { items: [{ altitude: { value: 5400, unit: "foot" } }] },
      },
    ],
  };
  expect(beanJsonLd(doc, 0)!["additionalProperty"]).toEqual([
    {
      "@type": "PropertyValue",
      name: "altitude",
      value: 5400,
      unitCode: "FOT",
    },
  ]);
});

test("the roaster defaults to Organization; a person-typed roaster stays a Person; nameless is omitted", () => {
  const doc = (roaster: object): CoffeeJSONDocument => ({
    coffeejson: "1.0",
    beans: [{ name: "x", roaster } as never],
  });
  expect(beanJsonLd(doc({ name: "R" }), 0)).toHaveProperty("brand", {
    "@type": "Organization",
    name: "R",
  });
  expect(beanJsonLd(doc({ name: "R", type: "person" }), 0)).toHaveProperty(
    "brand",
    { "@type": "Person", name: "R" },
  );
  expect(beanJsonLd(doc({ url: "https://example.com" }), 0)).not.toHaveProperty(
    "brand",
  );
});

test("every corpus bean exports a Product carrying its roaster and its listing", () => {
  for (const [file, doc] of [
    ...docsIn("recipes"),
    ...docsIn("fixtures/valid"),
  ]) {
    (doc.beans ?? []).forEach((b, i) => {
      const ld = beanJsonLd(doc, i)!;
      expect(ld, `${file} bean ${i}`).not.toBeNull();
      expect(ld["@type"], file).toBe("Product");
      expect(ld, file).not.toHaveProperty("offers");
      if (b.roaster?.name)
        expect((ld["brand"] as { name: string }).name, file).toBe(
          b.roaster.name,
        );
      if (b.url) expect(ld["sameAs"], file).toBe(b.url);
    });
  }
});
