import type {
  Bean,
  CoffeeJSONDocument,
  Filter,
  Measurement,
  Recipe,
  Step,
  UnitSystem,
} from "@coffeejson/core";
import { convertMeasurement, FORMAT_VERSION } from "@coffeejson/core";

export interface StepFormState {
  at_s: string;
  cumulative: string;
  instruction: string;
  kind: string;
}
export interface RecipeFormState {
  title: string;
  method: string;
  brewerLabel: string;
  coffee: string;
  water: string;
  ratio: string;
  yield: string;
  pressure: string;
  preinfusion_s: string;
  basketLabel: string;
  waterTempC: string;
  grindSetting: string;
  filterMaterial: string;
  filterLabel: string;
  // Where the recipe was PUBLISHED, not the producing app — that is the
  // document's `generator`, which no hand-authoring form asks a human to fill in.
  steps: StepFormState[];
  finish_s: string;
  basedOn: string;
  recommended: boolean;
}
export interface OriginItemFormState {
  name: string;
  country: string;
  region: string;
  process: string;
  percentage: string;
}
export interface BeanFormState {
  name: string;
  roaster: string;
  url: string;
  process: string;
  roastLevel: string;
  description: string;
  origin: OriginItemFormState[];
}
export interface BuilderState {
  beanForms: BeanFormState[];
  recipeForms: RecipeFormState[];
}

export const emptyStepForm = (): StepFormState => ({
  at_s: "",
  cumulative: "",
  instruction: "",
  kind: "",
});
export const emptyRecipeForm = (): RecipeFormState => ({
  title: "",
  method: "",
  brewerLabel: "",
  coffee: "",
  water: "",
  ratio: "",
  yield: "",
  pressure: "",
  preinfusion_s: "",
  basketLabel: "",
  waterTempC: "",
  grindSetting: "",
  filterMaterial: "",
  filterLabel: "",
  steps: [],
  finish_s: "",
  basedOn: "",
  recommended: false,
});
export const emptyOriginItemForm = (): OriginItemFormState => ({
  name: "",
  country: "",
  region: "",
  process: "",
  percentage: "",
});
export const emptyBeanForm = (): BeanFormState => ({
  name: "",
  roaster: "",
  url: "",
  process: "",
  roastLevel: "",
  description: "",
  origin: [],
});

export const num = (s: string): number | undefined => {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
};
const grams = (s: string): Measurement | undefined => {
  const v = num(s);
  return v === undefined ? undefined : { value: v, unit: "gram" };
};

export function perPourAmounts(
  cumulatives: (number | undefined)[],
): (number | undefined)[] {
  let prev = 0;
  return cumulatives.map((c) => {
    if (c === undefined) return undefined;
    const d = c - prev;
    prev = c;
    return d;
  });
}
export function stepsNonDecreasing(
  cumulatives: (number | undefined)[],
): boolean {
  let prev = -Infinity;
  for (const c of cumulatives) {
    if (c === undefined) continue;
    if (c < prev) return false;
    prev = c;
  }
  return true;
}

function buildSteps(forms: StepFormState[]): Step[] {
  return forms
    .filter(
      (s) =>
        s.instruction.trim() ||
        s.cumulative.trim() ||
        s.at_s.trim() ||
        (s.kind && s.kind !== "pour"),
    )
    .map((s) => {
      const step: Step = {};
      if (s.kind && s.kind !== "pour") step.kind = s.kind;
      const at = num(s.at_s);
      if (at !== undefined) step.at_s = at;
      const c = grams(s.cumulative);
      if (c) step.to_water = c;
      if (s.instruction.trim()) step.instruction = s.instruction.trim();
      return step;
    });
}

export function buildRecipe(form: RecipeFormState): Recipe {
  const espresso = form.method === "espresso";
  // Emit the invalid document anyway, so the live validator names what is missing.
  const recipe = {
    title: form.title.trim(),
    coffee: grams(form.coffee),
  } as Recipe;
  if (form.method) recipe.method = form.method;
  if (form.brewerLabel.trim())
    recipe.brewer = { id: "custom", label: form.brewerLabel.trim() };
  if (espresso) {
    recipe.basis = "yield";
    const y = grams(form.yield);
    if (y) recipe.yield = y;
    const p = num(form.pressure);
    if (p !== undefined) recipe.pressure = { value: p, unit: "bar" };
    const pre = num(form.preinfusion_s);
    if (pre !== undefined) recipe.preinfusion_s = pre;
    if (form.basketLabel.trim())
      recipe.basket = { id: "custom", label: form.basketLabel.trim() };
  } else {
    const w = grams(form.water);
    if (w) recipe.water = w;
    const r = num(form.ratio);
    if (r !== undefined) recipe.ratio = r;
  }
  // A label with no material is not a filter, so it drops rather than emitting
  // a hollow object.
  if (form.filterMaterial) {
    const label = form.filterLabel.trim();
    recipe.filter = label
      ? { material: form.filterMaterial as Filter["material"], label }
      : { material: form.filterMaterial as Filter["material"] };
  }
  const temp = num(form.waterTempC);
  if (temp !== undefined) recipe.water_temp = { value: temp, unit: "celsius" };
  if (form.grindSetting.trim())
    recipe.grind = { setting: form.grindSetting.trim() };
  const steps = buildSteps(form.steps);
  if (steps.length) recipe.steps = steps;
  const fin = num(form.finish_s);
  if (fin !== undefined) recipe.finish_s = fin;
  if (form.basedOn.trim()) recipe.based_on = form.basedOn.trim();
  if (form.recommended) recipe.recommended = true;
  return recipe;
}

export function buildBean(form: BeanFormState): Bean {
  const bean = {} as Bean;
  if (form.name.trim()) bean.name = form.name.trim();
  if (form.roaster.trim()) bean.roaster = { name: form.roaster.trim() };
  if (form.url.trim()) bean.url = form.url.trim();
  if (form.process.trim()) bean.process = [form.process.trim()];
  if (form.roastLevel.trim()) bean.roast_level = form.roastLevel.trim();
  if (form.description.trim()) bean.description = form.description.trim();
  const items = form.origin
    .filter(
      (it) =>
        it.name.trim() ||
        it.country.trim() ||
        it.region.trim() ||
        it.process.trim(),
    )
    .map((it) => {
      const item: NonNullable<NonNullable<Bean["origin"]>["items"]>[number] =
        {};
      if (it.name.trim()) item.name = it.name.trim();
      if (it.country.trim()) item.country = it.country.trim();
      if (it.region.trim()) item.region = it.region.trim();
      if (it.process.trim()) item.process = [it.process.trim()];
      const pct = Number(it.percentage);
      if (it.percentage.trim() && Number.isFinite(pct)) item.percentage = pct;
      return item;
    });
  // schema enum for origin.type is "single" | "blend" (never "single_origin").
  if (items.length)
    bean.origin = { type: items.length > 1 ? "blend" : "single", items };
  return bean;
}

export function buildDocument(state: BuilderState): CoffeeJSONDocument {
  const doc: CoffeeJSONDocument = {
    coffeejson: FORMAT_VERSION,
    recipes: state.recipeForms.map(buildRecipe),
  };
  const beans = state.beanForms
    .map(buildBean)
    .filter((b) => Object.keys(b).length > 0);
  if (beans.length) doc.beans = beans;
  return doc;
}

// The inverse of buildDocument/buildRecipe/buildBean, for /generate's paste-or-drop
// edit mode. Only what the forward direction supports round-trips;
// `collectDroppedPaths` names the rest at import time.
const str = (n: number | undefined): string =>
  n === undefined ? "" : String(n);
// The form offers one process box where the wire carries a set, so editing a
// document that states several keeps the first: a starter tool, not an editor.
const firstProcess = (p: string[] | undefined): string => p?.[0] ?? "";

// Import is a consumer act, so the conformance rule applies: convert any unit you
// recognize into the form's canonical store (gram / °C / bar), and treat an
// unrecognized one as ABSENT — never reinterpret the bare number under the form's
// unit label, which asserts a value the document never stated.
// One number per quantity, so a WINDOW has nowhere to go and a midpoint would be
// a number the source never published. It reads as empty, and the warning names it.
const point = (m: Measurement | undefined): number | undefined =>
  m === undefined ? undefined : m.value;
// `convertMeasurement` is the conversion; this states which unit the form stores
// in, which is the form's own decision. A quantity that does not arrive in `unit`
// after it converts was stated in a unit with no path there, so it is absent.
const inUnit = (
  m: Measurement | undefined,
  unit: string,
  system: UnitSystem,
): string => {
  if (point(m) === undefined) return "";
  const converted = convertMeasurement(m!, system);
  return converted.unit === unit && converted.value !== undefined
    ? String(converted.value)
    : "";
};
const massG = (m: Measurement | undefined): string =>
  inUnit(m, "gram", "metric");
const tempC = (m: Measurement | undefined): string =>
  inUnit(m, "celsius", "metric");
const pressureBar = (m: Measurement | undefined): string =>
  inUnit(m, "bar", "as-authored");

function recipeToForm(r: Recipe): RecipeFormState {
  const cumStep = (s: Step): StepFormState => ({
    at_s: str(s.at_s),
    cumulative: massG(s.to_water),
    instruction: s.instruction ?? "",
    kind: s.kind ?? "",
  });
  return {
    ...emptyRecipeForm(),
    title: r.title ?? "",
    method: r.method ?? "",
    brewerLabel: r.brewer?.label ?? "",
    coffee: massG(r.coffee),
    water: massG(r.water),
    ratio: str(r.ratio),
    yield: massG(r.yield),
    pressure: pressureBar(r.pressure),
    preinfusion_s: str(r.preinfusion_s),
    basketLabel: r.basket?.label ?? "",
    waterTempC: tempC(r.water_temp),
    grindSetting: r.grind?.setting ?? "",
    filterMaterial: r.filter?.material ?? "",
    filterLabel: r.filter?.label ?? "",
    steps: (r.steps ?? []).map(cumStep),
    finish_s: str(r.finish_s),
    basedOn: r.based_on ?? "",
    recommended: r.recommended === true,
  };
}

function beanToForm(b: Bean): BeanFormState {
  return {
    ...emptyBeanForm(),
    name: b.name ?? "",
    roaster: b.roaster?.name ?? "",
    url: b.url ?? "",
    process: firstProcess(b.process),
    roastLevel: b.roast_level ?? "",
    description: b.description ?? "",
    origin: (b.origin?.items ?? []).map((it) => ({
      ...emptyOriginItemForm(),
      name: it.name ?? "",
      country: it.country ?? "",
      region: it.region ?? "",
      process: firstProcess(it.process),
      percentage: str(it.percentage),
    })),
  };
}

export function documentToState(doc: CoffeeJSONDocument): BuilderState {
  return {
    beanForms: (doc.beans ?? []).map(beanToForm),
    recipeForms: (doc.recipes ?? []).map(recipeToForm),
  };
}

// Diff an imported document against what the page re-emits and name every member
// the round trip loses (re-authoring MAY drop, SHOULD disclose). Only MISSING keys
// count — a value difference is normalization — and emptyish members are skipped
// because the wire treats them as absent (`decaf: false` is a claim, and is kept).
// A contentless step shifts indices; real documents carry none.
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const emptyish = (v: unknown, key: string): boolean =>
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (isObj(v) && Object.keys(v).length === 0) ||
  (v === false && key === "recommended");

export function collectDroppedPaths(
  original: unknown,
  rebuilt: unknown,
  path = "",
): string[] {
  if (Array.isArray(original)) {
    if (!Array.isArray(rebuilt)) return [path];
    const out: string[] = [];
    original.forEach((v, i) => {
      const p = `${path}[${i}]`;
      if (i >= rebuilt.length) {
        if (!emptyish(v, "")) out.push(p);
      } else out.push(...collectDroppedPaths(v, rebuilt[i], p));
    });
    return out;
  }
  if (isObj(original)) {
    if (!isObj(rebuilt)) return [path];
    const out: string[] = [];
    for (const [key, v] of Object.entries(original)) {
      const p = path ? `${path}.${key}` : key;
      if (!(key in rebuilt)) {
        if (!emptyish(v, key)) out.push(p);
      } else out.push(...collectDroppedPaths(v, rebuilt[key], p));
    }
    return out;
  }
  return [];
}
