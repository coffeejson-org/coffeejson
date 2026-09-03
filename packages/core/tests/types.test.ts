import { expect, test } from "vitest";
import type {
  BeanLocalization,
  DecodedDocument,
  DocumentGenerator,
  MeasuredCup,
  NormalizedDoc,
  NormalizedFilter,
  NormalizedGenerator,
  NormalizedRecipe,
  PerceivedAxes,
  CoffeeJSONDocument as PublicDoc,
  Tasting as PublicTasting,
  RecipeLocalization,
  StepLocalization,
} from "../src/index";
import { checkEnvelope, normalize } from "../src/index";
import type {
  Bean,
  CoffeeJSONDocument,
  Measurement,
  Origin,
  OriginItem,
  Recipe,
  RestWindow,
  Step,
  Tasting,
} from "../src/types";

test("wire types compile and accept a minimal document", () => {
  const r: Recipe = { title: "t", coffee: { value: 15, unit: "gram" } };
  const doc: CoffeeJSONDocument = { coffeejson: "1.0", recipes: [r] };
  expect(doc.recipes![0]!.title).toBe("t");
});

// A wire type that cannot name a published field forces the consumer to cast,
// which is the same as having no types at all. Throughout this file `tsc` is the
// real assertion; the runtime expectations only keep vitest honest it ran.
test("wire types name every field the published schema defines", () => {
  const step: Step = { kind: "pour", at_s: 30, action_duration_s: 12 };
  const r: Recipe = {
    id: "morning",
    title: "V60",
    coffee: { value: 15, unit: "gram" },
    basket: { id: "vst-18g", label: "VST 18 g" },
    filter: { material: "paper", label: "Hario tabbed" },
    steps: [step],
  };
  expect(r.id).toBe("morning");
  expect(r.filter!.material).toBe("paper");
  expect(r.steps![0]!.action_duration_s).toBe(12);
});

// Every type reachable from an exported signature must itself be exported. The
// test above imports from ../src/types, the module, so it is blind to what the
// entry point exposes; this one imports the way a consumer does.
test("the package entry point exports every type its signatures reach", () => {
  const stepL: StepLocalization = {
    instruction: "Verser doucement",
    label: "Fleurissement",
  };
  const recipeL: RecipeLocalization = {
    title: "V60 du dimanche",
    steps: [stepL],
  };
  const beanL: BeanLocalization = {
    name: "Nano Challa",
    roaster_notes: ["jasmin", "pêche"],
  };
  const gen: DocumentGenerator = { name: "ExampleBrewApp", version: "2.3.0" };

  const doc: PublicDoc = {
    coffeejson: "1.0",
    generator: gen,
    beans: [{ name: "Nano Challa", lang: "en", localizations: { fr: beanL } }],
    recipes: [
      {
        title: "Sunday V60",
        coffee: { value: 15, unit: "gram" },
        lang: "en",
        localizations: { fr: recipeL },
      },
    ],
  };

  // The view-model side: both are nameable from outside the package.
  const filter: NormalizedFilter = { material: "paper", label: "Hario tabbed" };
  const normGen: NormalizedGenerator = {
    name: "ExampleBrewApp",
    version: "2.3.0",
    url: null,
  };
  // Assigning them into the shapes that reference them proves the types line up,
  // not merely that the names resolve.
  const takesFilter = (f: NormalizedRecipe["filter"]) => f?.material ?? "";
  const takesGenerator = (d: Pick<NormalizedDoc, "generator">) =>
    d.generator?.name ?? "";

  expect(doc.generator!.name).toBe("ExampleBrewApp");
  expect(doc.recipes![0]!.localizations!["fr"]!.steps![0]!.label).toBe(
    "Fleurissement",
  );
  expect(doc.beans![0]!.localizations!["fr"]!.roaster_notes).toEqual([
    "jasmin",
    "pêche",
  ]);
  expect(takesFilter(filter)).toBe("paper");
  expect(takesGenerator({ generator: normGen })).toBe("ExampleBrewApp");
});

// The third collection: a document can carry tastings, so a consumer must be able
// to name one without casting past the package's own types.
test("wire types name every field a tasting declares", () => {
  const t: Tasting = {
    id: "monday",
    recipe_ref: "morning-v60",
    bean_ref: "guji-uraga",
    rating: 4,
    perceived: { extraction: -0.2, strength: 0.1 },
    descriptors: ["blackberry", "dark chocolate"],
    note: "best one this week",
    lang: "en",
    measured: { tds: 1.38, yield: { value: 258, unit: "gram" } },
  };
  const doc: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [
      {
        id: "morning-v60",
        title: "Morning V60",
        coffee: { value: 18, unit: "gram" },
      },
    ],
    tastings: [t],
  };
  expect(doc.tastings![0]!.measured!.yield!.value).toBe(258);
  expect(doc.tastings![0]!.perceived!.extraction).toBe(-0.2);
});

// Same rule as the entry-point test above: a type reachable from an exported
// signature must be nameable by a consumer, and `Tasting` reaches two.
test("the entry point exports the tasting's sub-shapes", () => {
  const perceived: PerceivedAxes = { extraction: 0, strength: -0.3 };
  const measured: MeasuredCup = { tds: 9.4 };
  const t: PublicTasting = { rating: 5, perceived, measured };
  const takesPerceived = (p: PublicTasting["perceived"]) => p?.strength ?? 0;
  expect(takesPerceived(t.perceived)).toBe(-0.3);
  expect(t.measured!.tds).toBe(9.4);
});

// What a decode establishes, and what it does not. `tsc` is the assertion: a
// decode result whose collections typed as entities would let a consumer read
// `recipes[0].title` off a slot the check never looked inside.
test("a decoded envelope types its collections as unread", () => {
  const r = checkEnvelope({ coffeejson: "1.0", recipes: [17] });
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const first: unknown = r.document.recipes![0];
  expect(first).toBe(17);
  // A producer-authored document is one of these; the check does not prove the reverse.
  const authored: CoffeeJSONDocument = {
    coffeejson: "1.0",
    recipes: [{ title: "t", coffee: { value: 15, unit: "gram" } }],
  };
  const decoded: DecodedDocument = authored;
  expect(decoded.coffeejson).toBe("1.0");
  // The typed read is `normalize`'s, which takes an unchecked value — and drops the slot.
  expect(normalize(r.document).recipes).toHaveLength(0);
});

// `index.ts`'s policy: a consumer holding a value can name its type without an
// indexed access. A bean's origin and rest window are values a consumer holds.
test("a bean's nested wire shapes have names of their own", () => {
  const altitude: Measurement = { min: 1600, max: 1900, unit: "meter" };
  const item: OriginItem = {
    name: "Kochere",
    country: "ET",
    altitude,
    varietals: ["Kurume"],
  };
  const origin: Origin = { type: "single", items: [item] };
  const rest: RestWindow = { min: 7, max: 60 };
  const bean: Bean = { name: "Nano Challa", origin, rest_days: rest };
  expect(bean.origin!.items![0]!.altitude!.unit).toBe("meter");
  expect(bean.rest_days!.max).toBe(60);
});
