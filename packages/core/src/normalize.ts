import type { Measurement } from "./types.js";
import { gearLabel, magnitude } from "./format.js";
import { associatedMember } from "./association.js";
import { calendarDay, isObj, measurement, num, objItems, partyName, str, strArr } from "./json.js";
import { convertMassValue, mapMagnitudes } from "./units.js";

export interface NormalizedStep {
  kind: string | null;
  atS: number | null;
  toWater: Measurement | null;
  /**
   * Per-pour increment: cumulative `to_water` against the last cumulative seen,
   * so a non-pour step does not break the chain and the first targeted step fills
   * from 0. Null when the delta is not strictly positive. Unrounded.
   */
  pourDelta: Measurement | null;
  text: string;
}
export interface NormalizedGrind {
  grinderLabel: string;
  setting: string | null;
  micronsApprox: number | null;
  /** Qualitative coarseness, as authored: an unrecognized token is carried for
   *  `vocabularyLabel` to drop, the way every closed set is handled. */
  size: string | null;
}
/** A credited party. `role` is an open registry, so an unrecognized one is
 *  carried for display beside the name rather than dropped with the party.
 *  `url` travels as authored: it goes through `safeUrl` where it becomes an
 *  `href`, like every other link. */
export interface NormalizedParty {
  name: string;
  role: string | null;
  url: string | null;
  type: string | null;
}
export interface NormalizedOriginItem {
  name: string | null;
  country: string | null;
  region: string | null;
  /** Everyone credited with growing this component, in the source's order — a
   *  farmer and their farm, a cooperative and its washing station. */
  producers: NormalizedParty[];
  altitude: Measurement | null;
  /** This component's own varieties, for a blend whose components differ. */
  varietals: string[];
  /** The wire shape: `process` is a set, because a coffee often has more than
   *  one to state. Empty when the source names none. */
  process: string[];
  harvestTime: string | null;
  percentage: number | null;
}
export interface NormalizedBean {
  id: string | null;
  name: string | null;
  roaster: NormalizedParty | null;
  url: string | null;
  originItems: NormalizedOriginItem[];
  /** A set, like an origin item's — see `NormalizedOriginItem.process`. */
  process: string[];
  dryingMethod: string | null;
  varietals: string[];
  roastLevel: string | null;
  roastAgtron: number | null;
  roastDate: string | null;
  roasterNotes: string[];
  description: string | null;
}
export interface NormalizedAddition {
  kind: "ice" | "other";
  amount: Measurement | null;
}
/** The brew filter as stated: the material is what travels, the label names the product. */
export interface NormalizedFilter {
  material: string;
  label: string | null;
}
export interface NormalizedRecipe {
  /** Document-scoped identifier, so this recipe can be named from outside the
   *  document — what a tasting's `recipe_ref` resolves against. */
  id: string | null;
  title: string | null;
  method: string | null;
  isEspresso: boolean;
  brewerLabel: string;
  coffee: Measurement | null;
  water: Measurement | null;
  yield: Measurement | null;
  ratio: number | null;
  waterTemp: Measurement | null;
  grind: NormalizedGrind | null;
  pressure: Measurement | null;
  preinfusionS: number | null;
  basketLabel: string;
  filter: NormalizedFilter | null;
  steps: NormalizedStep[];
  finishS: number | null;
  recommended: boolean;
  bean: NormalizedBean | null;
  notes: string | null;
  additions: NormalizedAddition[];
  /** Who published this recipe, and where it came from — what a page crediting a
   *  transcription needs, and what a JSON-LD exporter reads. */
  author: NormalizedParty | null;
  basedOn: string | null;
  description: string | null;
  /** BCP-47 tag for this recipe's own human text. */
  lang: string | null;
  /** `YYYY-MM-DD`, and absent when the string names no day the calendar has. */
  datePublished: string | null;
}
export interface NormalizedGenerator {
  name: string;
  version: string | null;
  url: string | null;
}
/** How the cup was perceived. Both axes run -1 to 1 with 0 "about right", and
 *  that scale belongs to these two dimensions rather than to the object. */
export interface NormalizedPerceived {
  extraction: number | null;
  strength: number | null;
}
/** What an instrument read. Kept apart from the impression so no renderer can
 *  present one as the other — the seam the entity exists to mark. */
export interface NormalizedMeasured {
  /** Total dissolved solids, percent by mass. */
  tds: number | null;
  /** The beverage mass actually weighed out of this brew, as authored. */
  yield: Measurement | null;
}
export interface NormalizedTasting {
  id: string | null;
  rating: number | null;
  perceived: NormalizedPerceived | null;
  descriptors: string[];
  note: string | null;
  lang: string | null;
  measured: NormalizedMeasured | null;
  /** Extraction yield for this cup, as a percentage — derived, never carried on
   *  the wire. Null unless all three inputs are usable; see `extractionYieldOf`. */
  extractionYield: number | null;
  /** The recipe this cup was brewed from, resolved by an exact `recipe_ref`
   *  match. Null when the reference names nothing, and null when there is no
   *  reference: co-location associates a coffee, never a recipe. */
  recipe: NormalizedRecipe | null;
  /** The coffee that was brewed, by the tasting's OWN reference first and by
   *  co-location on a single bean otherwise — so a cup brewed with a different
   *  bag than the recipe calls for reports the bag it was actually brewed with. */
  bean: NormalizedBean | null;
}
export interface NormalizedDoc {
  beans: NormalizedBean[];
  recipes: NormalizedRecipe[];
  tastings: NormalizedTasting[];
  /** A document-level fact, so it is projected here and never onto a recipe. */
  generator: NormalizedGenerator | null;
}

// A party is its name: an entry naming nobody credits nobody. The role travels
// whatever it says, because the spec makes showing an unrecognized one a MUST.
const parties = (v: unknown): NormalizedParty[] => {
  const out: NormalizedParty[] = [];
  for (const p of objItems(v)) {
    const name = partyName(p);
    if (name !== null)
      out.push({ name, role: str(p["role"]), url: str(p["url"]), type: str(p["type"]) });
  }
  return out;
};

// A filter without a material is not a filter — the material is what changes the
// cup — so a hollow object reads as absent rather than as an empty row.
const filterOf = (v: unknown): NormalizedFilter | null => {
  if (!isObj(v)) return null;
  const material = str(v["material"]);
  return material ? { material, label: str(v["label"]) } : null;
};

// A window scales bound by bound and stays a window; a measurement with no
// magnitude at all states nothing, and a scaled nothing is still nothing.
const scaleMagnitudes = (m: Measurement, by: number): Measurement | null =>
  m.value === undefined && m.min === undefined && m.max === undefined
    ? null
    : mapMagnitudes(m, (n) => n * by, m.unit);

// `ratio` is water ÷ coffee BY MASS, so both operands come to grams before they
// divide. A unit with no mass conversion derives nothing: water stated by volume
// would need its temperature-dependent density, which the spec leaves undefined,
// and an unrecognized unit is treated as absent.
const grams = (m: Measurement | null): number | null => {
  const value = magnitude(m);
  return m === null || value === null ? null : convertMassValue(value, m.unit, "gram");
};

const additions = (v: unknown): NormalizedAddition[] =>
  objItems(v).map((a): NormalizedAddition => ({
    kind: str(a["type"]) === "ice" ? "ice" : "other",
    amount: measurement(a["amount"]),
  }));

const normalizeStepBase = (v: Record<string, unknown>): Omit<NormalizedStep, "pourDelta"> => ({
  kind: str(v["kind"]),
  atS: num(v["at_s"]),
  toWater: measurement(v["to_water"]),
  text: str(v["label"]) ?? str(v["instruction"]) ?? "",
});

// pourDelta depends on the *sequence* of steps, where every other field is a pure
// function of one step object — hence a second, stateful pass.
function pourDeltaFor(toWater: Measurement | null, lastCumulative: Measurement | null): Measurement | null {
  if (toWater === null) return null;
  // No prior cumulative: the first targeted step fills from an implicit 0.
  const prevMagnitude = magnitude(lastCumulative);
  const prevInCurrentUnit = lastCumulative === null
    ? 0
    : prevMagnitude === null
      ? null
      : convertMassValue(prevMagnitude, lastCumulative.unit, toWater.unit);
  if (prevInCurrentUnit === null) return null;
  const current = magnitude(toWater);
  if (current === null) return null;
  const delta = current - prevInCurrentUnit;
  return delta > 0 ? { value: delta, unit: toWater.unit } : null;
}

function normalizeSteps(rawSteps: unknown): NormalizedStep[] {
  let lastCumulative: Measurement | null = null;
  return objItems(rawSteps).map((raw) => {
    const base = normalizeStepBase(raw);
    const pourDelta = pourDeltaFor(base.toWater, lastCumulative);
    // A step with usable to_water always updates the baseline — even when its
    // own delta came back null (a decrease, a zero fill, or an incomparable unit).
    if (base.toWater !== null) lastCumulative = base.toWater;
    return { ...base, pourDelta };
  });
}

function normalizeBean(v: Record<string, unknown>): NormalizedBean {
  const origin = isObj(v["origin"]) ? v["origin"] : null;
  return {
    id: str(v["id"]),
    name: str(v["name"]),
    roaster: parties([v["roaster"]])[0] ?? null,
    url: str(v["url"]),
    originItems: origin
      ? objItems(origin["items"]).map((it) => ({
          name: str(it["name"]),
          country: str(it["country"]),
          region: str(it["region"]),
          producers: parties(it["producers"]),
          altitude: measurement(it["altitude"]),
          varietals: strArr(it["varietals"]),
          process: strArr(it["process"]),
          harvestTime: str(it["harvest_time"]),
          percentage: num(it["percentage"]),
        }))
      : [],
    process: strArr(v["process"]),
    dryingMethod: str(v["drying_method"]),
    varietals: strArr(v["varietals"]),
    roastLevel: str(v["roast_level"]),
    roastAgtron: num(v["roast_agtron"]),
    roastDate: calendarDay(v["roast_date"]),
    roasterNotes: strArr(v["roaster_notes"]),
    description: str(v["description"]),
  };
}

function normalizeRecipe(v: Record<string, unknown>, beans: NormalizedBean[]): NormalizedRecipe {
  const method = str(v["method"]);
  const basis = str(v["basis"]);
  const coffee = measurement(v["coffee"]);
  const water = measurement(v["water"]);
  const yield_ = measurement(v["yield"]);
  const explicitRatio = num(v["ratio"]);
  // `basis` is the structural switch and `method` is descriptive, so a stated
  // basis decides. A basis absent or unrecognized is derived from the quantities
  // present, in this order; a recipe stating none leaves only its method to go on.
  const isEspresso = basis === "yield" ? true
    : basis === "water" ? false
    : water !== null || explicitRatio !== null ? false
    : yield_ !== null ? true
    : method === "espresso";
  const doseGrams = grams(coffee);
  const dose = doseGrams !== null && doseGrams > 0 ? doseGrams : null;
  const yieldGrams = grams(yield_);
  const waterGrams = grams(water);
  // The measurements are authoritative and `ratio` is a convenience, so a stated
  // ratio stands only where `coffee` and `water` state none of their own.
  const rawRatio = isEspresso
    ? yieldGrams !== null && dose !== null ? yieldGrams / dose : null
    : (waterGrams !== null && dose !== null ? waterGrams / dose : null) ?? explicitRatio;
  // Drop non-finite or non-positive ratios rather than letting a renderer
  // display "1 : Infinity" verbatim.
  const ratio = rawRatio !== null && Number.isFinite(rawRatio) && rawRatio > 0 ? rawRatio : null;
  // A recipe states its water or the ratio it follows from, so each fixes the
  // other and "20 g at 1:15" renders with water. A windowed dose derives a
  // windowed water: a midpoint would publish a number the author never wrote.
  const waterFromRatio = !isEspresso && water === null && ratio !== null && coffee !== null
    // A ratio is dimensionless, so the dose's own unit carries — but only a unit
    // the ratio is defined against, which is the one that converts to a mass.
    && doseGrams !== null
    ? scaleMagnitudes(coffee, ratio)
    : null;
  const grind = isObj(v["grind"]) ? v["grind"] : null;
  const bean = associatedMember(beans, str(v["bean_ref"]), (b) => b.id);
  return {
    id: str(v["id"]),
    title: str(v["title"]),
    method,
    isEspresso,
    brewerLabel: gearLabel(v["brewer"]),
    coffee,
    water: water ?? waterFromRatio,
    yield: yield_,
    ratio,
    waterTemp: measurement(v["water_temp"]),
    grind: grind
      ? {
          grinderLabel: gearLabel(grind["grinder"]),
          setting: str(grind["setting"]),
          micronsApprox: num(grind["microns_approx"]),
          size: str(grind["size"]),
        }
      : null,
    pressure: measurement(v["pressure"]),
    preinfusionS: num(v["preinfusion_s"]),
    basketLabel: gearLabel(v["basket"]),
    filter: filterOf(v["filter"]),
    steps: normalizeSteps(v["steps"]),
    finishS: num(v["finish_s"]),
    recommended: v["recommended"] === true,
    bean,
    notes: str(v["notes"]),
    additions: additions(v["additions"]),
    author: parties([v["author"]])[0] ?? null,
    basedOn: str(v["based_on"]),
    description: str(v["description"]),
    lang: str(v["lang"]),
    datePublished: calendarDay(v["date_published"]),
  };
}

// A `perceived` stating neither axis says nothing: absent, not a row of nulls.
function perceivedOf(v: unknown): NormalizedPerceived | null {
  if (!isObj(v)) return null;
  const extraction = num(v["extraction"]);
  const strength = num(v["strength"]);
  return extraction === null && strength === null ? null : { extraction, strength };
}

function measuredOf(v: unknown): NormalizedMeasured | null {
  if (!isObj(v)) return null;
  const tds = num(v["tds"]);
  const yield_ = measurement(v["yield"]);
  return tds === null && yield_ === null ? null : { tds, yield: yield_ };
}

// (beverage mass × TDS %) ÷ dose, as a percentage. The format does not carry it —
// beside its inputs it would have two homes that can disagree. Beverage mass is
// the tasting's own `measured.yield`, else the recipe's target `yield`. Windows
// collapse to midpoints. Unrounded.
function extractionYieldOf(
  measured: NormalizedMeasured | null,
  recipe: NormalizedRecipe | null,
): number | null {
  const tds = measured?.tds ?? null;
  if (tds === null || tds <= 0 || recipe === null) return null;
  const dose = recipe.coffee;
  const doseMagnitude = magnitude(dose);
  if (dose === null || doseMagnitude === null || doseMagnitude <= 0) return null;
  const beverage = measured?.yield ?? recipe.yield;
  const beverageMagnitude = magnitude(beverage);
  if (beverage === null || beverageMagnitude === null || beverageMagnitude <= 0) return null;
  const beverageInDoseUnit = convertMassValue(beverageMagnitude, beverage.unit, dose.unit);
  if (beverageInDoseUnit === null) return null;
  const ey = (beverageInDoseUnit * tds) / doseMagnitude;
  return Number.isFinite(ey) && ey > 0 ? ey : null;
}

function normalizeTasting(
  v: Record<string, unknown>,
  recipes: NormalizedRecipe[],
  beans: NormalizedBean[],
): NormalizedTasting {
  // The two references resolve independently, and the tasting's own `bean_ref`
  // wins over the referenced recipe's: brewing someone else's recipe with your own
  // bag is a case the format expresses, not a conflict. `recipe_ref` has no
  // co-location fall-back — that rule triggers on a single BEAN and links a coffee.
  const recipeRef = str(v["recipe_ref"]);
  const recipe = recipeRef === null ? null : associatedMember(recipes, recipeRef, (r) => r.id);
  const measured = measuredOf(v["measured"]);
  return {
    id: str(v["id"]),
    rating: num(v["rating"]),
    perceived: perceivedOf(v["perceived"]),
    descriptors: strArr(v["descriptors"]),
    note: str(v["note"]),
    lang: str(v["lang"]),
    measured,
    extractionYield: extractionYieldOf(measured, recipe),
    recipe,
    bean: associatedMember(beans, str(v["bean_ref"]), (b) => b.id),
  };
}

// THE crash-safety boundary: a total function — any JSON value in, well-typed
// view-model out. Invalid fragments are dropped, not repaired, and downstream code
// never re-checks. No version gate (the codec owns the wire) and no schema
// validation (rendering is tolerant).
export function normalize(input: unknown): NormalizedDoc {
  if (!isObj(input)) return { beans: [], recipes: [], tastings: [], generator: null };
  const beans = objItems(input["beans"]).map(normalizeBean);
  const recipes = objItems(input["recipes"]).map((r) => normalizeRecipe(r, beans));
  const tastings = objItems(input["tastings"]).map((t) => normalizeTasting(t, recipes, beans));
  return { beans, recipes, tastings, generator: generatorOf(input["generator"]) };
}

// `name` is the whole identity: a generator naming no software states nothing.
function generatorOf(v: unknown): NormalizedGenerator | null {
  if (!isObj(v)) return null;
  const name = str(v["name"]);
  if (name === null || name === "") return null;
  return { name, version: str(v["version"]), url: str(v["url"]) };
}
