// **Every closed set the schema defines is here** — no admission criterion to
// remember, and a set the schema grows belongs here the day it lands.
//
//  1. ONE SOURCE per set: the schema's `enum`, in the schema's order, asserted
//     against the schema by `tests/vocabularies.test.ts`.
//  2. TOKENS ONLY. Labels live in `labels.ts`, typed by the unions below so a
//     missing token is a compile error there.
//  3. A UNION IS A VIEW, NEVER A WIRE TYPE. Forward compatibility requires a
//     consumer to accept an unknown enum value rather than reject the document,
//     so no growable field in `types.ts` is typed by one of these. Match against
//     them; do not gate on them.

/** Brewing technique. Unknown value → `other`. */
export const BREW_METHODS = [
  "pour_over", "immersion", "aeropress", "french_press", "moka", "cold_brew",
  "siphon", "cezve", "drip", "capsule", "espresso", "other",
] as const;
export type BrewMethod = (typeof BREW_METHODS)[number];

/** Step kind. **Absent means `pour`** — the schema's own default. Unknown → `other`. */
export const STEP_KINDS = [
  "pour", "bloom", "prep", "wait", "stir", "flip", "valve_open", "valve_close",
  "press", "drawdown", "distribute", "tamp", "pull", "other",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const DEFAULT_STEP_KIND: StepKind = "pour";

/** Post-harvest processing. A list-valued field: a coffee can state several. Unknown → `other`. */
export const PROCESSES = [
  "washed", "natural", "pulped_natural", "honey", "anaerobic",
  "carbonic_maceration", "wet_hulled", "other",
] as const;
export type Process = (typeof PROCESSES)[number];

/** Roast level, an ordered scale. Unknown → ignore the field, preferring `roast_agtron`. */
export const ROAST_LEVELS = [
  "light", "light_medium", "medium", "medium_dark", "dark", "extra_dark",
] as const;
export type RoastLevel = (typeof ROAST_LEVELS)[number];

/** The physical form a coffee is sold in. Unknown → `other`. */
export const BEAN_FORMS = [
  "bean", "ground", "pod", "drip_bag", "instant", "other",
] as const;
export type BeanForm = (typeof BEAN_FORMS)[number];

/** What the brew filter is made of. Unknown → `other`. */
export const FILTER_MATERIALS = ["paper", "metal", "cloth", "other"] as const;
export type FilterMaterial = (typeof FILTER_MATERIALS)[number];

/**
 * Qualitative grind coarseness, finest to coarsest. Unknown → ignore the field,
 * preferring the grinder's own `setting` or `microns_approx`.
 */
export const GRIND_SIZES = [
  "extra_fine", "fine", "medium_fine", "medium", "medium_coarse", "coarse",
  "extra_coarse",
] as const;
export type GrindSize = (typeof GRIND_SIZES)[number];

/** Which quantity a recipe states its brew by. Absent means `water` — the schema's own default. */
export const QUANTITY_BASES = ["water", "yield"] as const;
export type QuantityBasis = (typeof QUANTITY_BASES)[number];

export const DEFAULT_QUANTITY_BASIS: QuantityBasis = "water";

export const ORIGIN_TYPES = ["single", "blend"] as const;
export type OriginType = (typeof ORIGIN_TYPES)[number];

/** What kind of party a credit names. Unknown or absent → infer from the crediting field. */
export const PARTY_TYPES = ["person", "organization"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

/** What a roaster roasted the coffee for. Unknown → ignore the field. */
export const PREFERRED_EXTRACTIONS = ["espresso", "filter", "omni"] as const;
export type PreferredExtraction = (typeof PREFERRED_EXTRACTIONS)[number];

// Five unit enums, not one, because the schema constrains each dimension
// separately: brew water accepts a volume that a dose never does, and pressure
// has exactly one unit in 1.0. `Unit` is their union.

/** Coffee dose and beverage yield. */
export const MASS_UNITS = ["gram", "ounce"] as const;
export type MassUnit = (typeof MASS_UNITS)[number];

/** Brew water — mass, or the volume a source published. `milliliter` has no defined conversion to mass. */
export const WATER_UNITS = ["gram", "ounce", "milliliter"] as const;
export type WaterUnit = (typeof WATER_UNITS)[number];

/** Water temperature. */
export const TEMPERATURE_UNITS = ["celsius", "fahrenheit"] as const;
export type TemperatureUnit = (typeof TEMPERATURE_UNITS)[number];

/** Brew pressure. One unit in 1.0, and the set exists so a second one is a visible change. */
export const PRESSURE_UNITS = ["bar"] as const;
export type PressureUnit = (typeof PRESSURE_UNITS)[number];

/** Growing altitude. */
export const ALTITUDE_UNITS = ["meter", "foot"] as const;
export type AltitudeUnit = (typeof ALTITUDE_UNITS)[number];

/** Every unit identifier the format defines — derived, never transcribed. */
export type Unit = MassUnit | WaterUnit | TemperatureUnit | PressureUnit | AltitudeUnit;
export const UNITS: readonly Unit[] = [
  ...new Set<Unit>([...MASS_UNITS, ...WATER_UNITS, ...TEMPERATURE_UNITS, ...PRESSURE_UNITS, ...ALTITUDE_UNITS]),
];

// Open registries: ANY non-empty string is valid in both fields below. These are
// the values the format recommends so two producers describing the same thing use
// the same word; a consumer shows anything else generically.

/** Recommended `addition.type` values. `ice` is the one with a defined effect: it marks the recipe iced. */
export const RECOMMENDED_ADDITION_TYPES = [
  "ice", "milk", "sugar", "syrup", "water", "cream",
] as const;
export type RecommendedAdditionType = (typeof RECOMMENDED_ADDITION_TYPES)[number];

/** Recommended `producers[].role` values. A source that labels no part omits `role` rather than guessing. */
export const RECOMMENDED_PRODUCER_ROLES = [
  "producer", "farm", "cooperative", "washing_station", "mill", "exporter",
] as const;
export type RecommendedProducerRole = (typeof RECOMMENDED_PRODUCER_ROLES)[number];
