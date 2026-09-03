import { describe, expect, test } from "vitest";
import type {
  BeanFormState,
  BuilderState,
  RecipeFormState,
} from "../src/lib/builder";
import {
  buildBean,
  buildDocument,
  buildRecipe,
  collectDroppedPaths,
  documentToState,
  emptyBeanForm,
  emptyOriginItemForm,
  emptyRecipeForm,
  emptyStepForm,
  perPourAmounts,
  stepsNonDecreasing,
} from "../src/lib/builder";
import { validateDocument } from "../src/lib/validate";

const filterForm = (): RecipeFormState => ({
  ...emptyRecipeForm(),
  title: "Everyday V60",
  method: "pour_over",
  brewerLabel: "Hario V60",
  coffee: "15",
  water: "250",
  ratio: "",
  waterTempC: "94",
  grindSetting: "medium",
  steps: [
    { ...emptyStepForm(), at_s: "0", cumulative: "50", instruction: "bloom" },
    { ...emptyStepForm(), at_s: "45", cumulative: "150", instruction: "pour" },
    {
      ...emptyStepForm(),
      at_s: "90",
      cumulative: "250",
      instruction: "finish",
    },
  ],
  finish_s: "180",
});

const espressoForm = (): RecipeFormState => ({
  ...emptyRecipeForm(),
  title: "House Espresso",
  method: "espresso",
  coffee: "18",
  yield: "36",
  pressure: "9",
  preinfusion_s: "5",
  basketLabel: "18g VST",
  finish_s: "28",
});

describe("buildRecipe is method-aware", () => {
  test("filter method emits water/ratio, not espresso fields", () => {
    const r = buildRecipe(filterForm());
    expect(r.water).toEqual({ value: 250, unit: "gram" });
    expect(r.method).toBe("pour_over");
    expect(r.yield).toBeUndefined();
    expect(r.pressure).toBeUndefined();
    expect(r.preinfusion_s).toBeUndefined();
    expect(r.steps?.length).toBe(3);
  });
  test("espresso method emits yield/pressure/preinfusion/basket, not water/ratio", () => {
    const r = buildRecipe(espressoForm());
    expect(r.yield).toEqual({ value: 36, unit: "gram" });
    expect(r.pressure).toEqual({ value: 9, unit: "bar" });
    expect(r.preinfusion_s).toBe(5);
    expect(r.basket?.label).toBe("18g VST");
    expect(r.water).toBeUndefined();
    expect(r.ratio).toBeUndefined();
  });
  test("empty optional fields are omitted (no undefined/empty keys emitted)", () => {
    const r = buildRecipe({
      ...emptyRecipeForm(),
      title: "Bare",
      method: "",
      coffee: "20",
      water: "320",
    });
    expect(r).toEqual({
      title: "Bare",
      coffee: { value: 20, unit: "gram" },
      water: { value: 320, unit: "gram" },
    });
  });
});

describe("per-pour math + non-decreasing guard", () => {
  test("perPourAmounts returns cumulative deltas, undefined passes through", () => {
    expect(perPourAmounts([50, 150, 250])).toEqual([50, 100, 100]);
    expect(perPourAmounts([undefined, 100])).toEqual([undefined, 100]);
  });
  test("stepsNonDecreasing flags a target smaller than a prior one", () => {
    expect(stepsNonDecreasing([50, 150, 250])).toBe(true);
    expect(stepsNonDecreasing([50, 40])).toBe(false);
    expect(stepsNonDecreasing([50, undefined, 60])).toBe(true);
  });
});

describe("valid by construction (property): complete forms validate", () => {
  const forms: RecipeFormState[] = [
    filterForm(),
    espressoForm(),
    {
      ...emptyRecipeForm(),
      title: "Immersion",
      method: "french_press",
      coffee: "30",
      water: "500",
      steps: [
        { ...emptyStepForm(), kind: "press", instruction: "press slowly" },
      ],
    },
  ];
  for (const f of forms)
    test(`buildDocument([${f.title}]) validates against the schema`, () =>
      expect(
        validateDocument(buildDocument({ beanForms: [], recipeForms: [f] })),
      ).toEqual([]));
});

describe("buildBean", () => {
  test("emits identity + origin items with per-component name/process", () => {
    const f: BeanFormState = {
      ...emptyBeanForm(),
      name: "Monarch",
      roaster: "Onyx Coffee Lab",
      url: "https://onyxcoffeelab.com/products/monarch",
      process: "washed",
      roastLevel: "dark",
      description: "blend",
      origin: [
        { ...emptyOriginItemForm(), name: "The Queen", country: "CO" },
        {
          ...emptyOriginItemForm(),
          name: "Alaka",
          country: "ET",
          process: "natural",
        },
      ],
    };
    const b = buildBean(f);
    expect(b.name).toBe("Monarch");
    expect(b.origin?.items?.[1]).toMatchObject({
      name: "Alaka",
      country: "ET",
      process: ["natural"],
    });
    expect(b.roast_level).toBe("dark");
  });
  // The schema enum is "single" | "blend", not "single_origin".
  test('a single-item origin array emits origin.type "single" (not "single_origin")', () => {
    const f: BeanFormState = {
      ...emptyBeanForm(),
      name: "Solo Estate",
      origin: [
        { ...emptyOriginItemForm(), name: "La Esperanza", country: "CO" },
      ],
    };
    expect(buildBean(f).origin?.type).toBe("single");
  });
});

describe("buildDocument(state) — bundle", () => {
  test("emits beans only when present; recommended flags survive", () => {
    const state: BuilderState = {
      beanForms: [],
      recipeForms: [
        {
          ...emptyRecipeForm(),
          title: "A",
          method: "pour_over",
          coffee: "20",
          water: "320",
          recommended: true,
        },
      ],
    };
    const doc = buildDocument(state);
    expect(doc.beans).toBeUndefined();
    expect(doc.recipes![0]!.recommended).toBe(true);
  });
});

// Fixtures are constructed inline from the empty*Form factories rather than
// imported, to keep this suite independent of that fixture set.
describe("documentToState (edit mode) round-trips through buildDocument", () => {
  const sunriseBean = (): BeanFormState => ({
    ...emptyBeanForm(),
    name: "Sunrise Reserve",
    roaster: "Northbound Roasters",
    url: "https://example.com/sunrise-reserve",
    process: "honey",
    roastLevel: "medium_dark",
    description: "A bright, syrupy blend.",
    origin: [
      {
        ...emptyOriginItemForm(),
        name: "La Esperanza",
        country: "CO",
        region: "Huila",
        process: "washed",
        percentage: "60",
      },
      {
        ...emptyOriginItemForm(),
        name: "Guji Hambela",
        country: "ET",
        process: "natural",
        percentage: "40",
      },
    ],
  });

  const sunriseFilter = (): RecipeFormState => ({
    ...emptyRecipeForm(),
    title: "Sunrise V60",
    method: "pour_over",
    brewerLabel: "Hario V60",
    coffee: "15",
    water: "250",
    ratio: "16.7",
    waterTempC: "94",
    grindSetting: "medium-fine",
    recommended: true,
    basedOn: "https://example.com/sunrise-v60-guide",
    steps: [
      { ...emptyStepForm(), at_s: "0", cumulative: "50", instruction: "bloom" },
      {
        ...emptyStepForm(),
        at_s: "45",
        cumulative: "150",
        instruction: "first pour",
      },
      {
        ...emptyStepForm(),
        at_s: "90",
        cumulative: "250",
        instruction: "final pour",
      },
    ],
    finish_s: "180",
  });

  const sunriseEspresso = (): RecipeFormState => ({
    ...emptyRecipeForm(),
    title: "Sunrise Espresso",
    method: "espresso",
    coffee: "18",
    yield: "36",
    pressure: "9",
    preinfusion_s: "5",
    basketLabel: "18g VST",
    waterTempC: "93",
    grindSetting: "fine",
    finish_s: "28",
    recommended: true,
  });

  test("a built bundle survives document → state → document unchanged & valid", () => {
    const original = buildDocument({
      beanForms: [sunriseBean()],
      recipeForms: [sunriseFilter(), sunriseEspresso()],
    });
    const roundTripped = buildDocument(documentToState(original));
    expect(validateDocument(roundTripped)).toEqual([]);
    expect(roundTripped).toEqual(original);
  });

  test("populates espresso fields from an espresso document", () => {
    const doc = buildDocument({
      beanForms: [],
      recipeForms: [
        {
          ...emptyRecipeForm(),
          title: "Solo Shot",
          method: "espresso",
          coffee: "18",
          yield: "47",
          pressure: "9",
          finish_s: "27",
        },
      ],
    });
    const state = documentToState(doc);
    expect(state.recipeForms[0]!.method).toBe("espresso");
    expect(state.recipeForms[0]!.yield).toBe("47");
    expect(state.recipeForms[0]!.water).toBe("");
  });
});

// Import honesty. Two halves: units convert (a consumer act — never
// reinterpret a bare number under the form's unit label), and the drop-differ
// names exactly what the round trip loses.
describe("import unit conversion (documentToState)", () => {
  const doc = (recipe: object) =>
    ({ coffeejson: "1.0", recipes: [{ title: "t", ...recipe }] }) as never;

  test("ounce mass converts to grams; fahrenheit converts to celsius", () => {
    const state = documentToState(
      doc({
        coffee: { value: 1, unit: "ounce" },
        water: { value: 8.8, unit: "ounce" },
        water_temp: { value: 200, unit: "fahrenheit" },
      }),
    );
    // One decimal, because the conversion is `convertMeasurement`'s and that is
    // the precision it rounds to — finer than any brewing scale resolves.
    expect(state.recipeForms[0]!.coffee).toBe("28.3");
    expect(state.recipeForms[0]!.water).toBe("249.5");
    expect(state.recipeForms[0]!.waterTempC).toBe("93.3");
  });

  test("canonical units pass through untouched", () => {
    const state = documentToState(
      doc({
        coffee: { value: 15, unit: "gram" },
        water_temp: { value: 94, unit: "celsius" },
        pressure: { value: 9, unit: "bar" },
      }),
    );
    expect(state.recipeForms[0]!.coffee).toBe("15");
    expect(state.recipeForms[0]!.waterTempC).toBe("94");
    expect(state.recipeForms[0]!.pressure).toBe("9");
  });

  test("an unrecognized unit becomes absent, never a reinterpreted number", () => {
    const state = documentToState(
      doc({
        coffee: { value: 15, unit: "stone" },
        water_temp: { value: 367, unit: "kelvin" },
      }),
    );
    expect(state.recipeForms[0]!.coffee).toBe("");
    expect(state.recipeForms[0]!.waterTempC).toBe("");
  });
});

describe("collectDroppedPaths (the drop-warning engine)", () => {
  const roundTrip = (doc: object): string[] => {
    const state = documentToState(doc as never);
    const rebuilt = buildDocument({
      beanForms: state.beanForms.slice(0, 1),
      recipeForms: state.recipeForms,
    });
    return collectDroppedPaths(doc, rebuilt);
  };

  test("names the recipe fields the form can't carry", () => {
    const dropped = roundTrip({
      coffeejson: "1.0",
      recipes: [
        {
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          author: { name: "Someone" },
          based_on: "https://example.com/post",
          notes: "long prose",
          lang: "en",
          grind: {
            setting: "22 clicks",
            size: "medium_fine",
            microns_approx: 700,
          },
        },
      ],
    });
    expect(dropped).toContain("recipes[0].author");
    expect(dropped).toContain("recipes[0].notes");
    expect(dropped).toContain("recipes[0].lang");
    expect(dropped).toContain("recipes[0].grind.size");
    expect(dropped).toContain("recipes[0].grind.microns_approx");
    expect(dropped).not.toContain("recipes[0].grind.setting");
    // `based_on` is authorable: the form's URL field means "where this was
    // published", which is what an author typing into it means.
    expect(dropped).not.toContain("recipes[0].based_on");
  });

  test("an imported document's `generator` is named as dropped", () => {
    // The form does not claim to be the software that wrote someone else's
    // document, so it says the stamp is lost rather than re-emitting one.
    const dropped = roundTrip({
      coffeejson: "1.0",
      generator: {
        name: "ExampleBrewApp",
        version: "2.3.0",
        url: "https://example.com/brewapp",
      },
      recipes: [
        {
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
        },
      ],
    });
    expect(dropped).toContain("generator");
  });

  test("registry gear downgrades honestly: brand/model are named, label survives", () => {
    const dropped = roundTrip({
      coffeejson: "1.0",
      recipes: [
        {
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          brewer: {
            id: "hario-v60",
            brand: "Hario",
            model: "V60",
            label: "Hario V60",
          },
        },
      ],
    });
    expect(dropped).toContain("recipes[0].brewer.brand");
    expect(dropped).toContain("recipes[0].brewer.model");
    expect(dropped).not.toContain("recipes[0].brewer.label");
  });

  test("semantically-absent members are not noise; explicit claims are loss", () => {
    const dropped = roundTrip({
      coffeejson: "1.0",
      beans: [{ name: "Nano Challa", decaf: false, images: [] }],
      recipes: [
        {
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          recommended: false,
          images: [],
        },
      ],
    });
    expect(dropped).not.toContain("recipes[0].recommended"); // false ≡ absent, per its spec text
    expect(dropped).not.toContain("recipes[0].images"); // empty ≡ absent
    expect(dropped).toContain("beans[0].decaf"); // false is an explicit claim — real loss
  });

  test("a second bean and unknown members are named wholesale", () => {
    const dropped = roundTrip({
      coffeejson: "1.0",
      beans: [{ name: "First" }, { name: "Second" }],
      recipes: [
        {
          title: "t",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          ext: { "app.example": { collection: "favorites" } },
        },
      ],
    });
    expect(dropped).toContain("beans[1]");
    expect(dropped).toContain("recipes[0].ext");
  });

  test("a document the form fully carries reports nothing", () => {
    const dropped = roundTrip({
      coffeejson: "1.0",
      recipes: [
        {
          title: "t",
          method: "pour_over",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          ratio: 16.7,
          water_temp: { value: 94, unit: "celsius" },
          finish_s: 180,
          steps: [
            {
              at_s: 0,
              to_water: { value: 50, unit: "gram" },
              instruction: "bloom",
            },
          ],
        },
      ],
    });
    expect(dropped).toEqual([]);
  });
});

describe("the brew filter is authorable", () => {
  test("a stated material emits a filter; a label rides along", () => {
    const r = buildRecipe({
      ...emptyRecipeForm(),
      title: "V60",
      method: "pour_over",
      coffee: "15",
      water: "250",
      filterMaterial: "paper",
      filterLabel: "Hario tabbed",
    });
    expect(r.filter).toEqual({ material: "paper", label: "Hario tabbed" });
  });

  test("a material with no label emits material alone, never an empty label", () => {
    const r = buildRecipe({
      ...emptyRecipeForm(),
      title: "Press",
      method: "french_press",
      coffee: "30",
      water: "500",
      filterMaterial: "metal",
    });
    expect(r.filter).toEqual({ material: "metal" });
  });

  test("no material emits no filter, even with a label typed", () => {
    const r = buildRecipe({
      ...emptyRecipeForm(),
      title: "V60",
      method: "pour_over",
      coffee: "15",
      water: "250",
      filterLabel: "orphan",
    });
    expect(r.filter).toBeUndefined();
  });

  test("a filter survives document → state → document", () => {
    const doc = buildDocument({
      beanForms: [],
      recipeForms: [
        {
          ...emptyRecipeForm(),
          title: "V60",
          method: "pour_over",
          coffee: "15",
          water: "250",
          filterMaterial: "cloth",
          filterLabel: "Nel",
        },
      ],
    });
    expect(buildDocument(documentToState(doc))).toEqual(doc);
  });
});
