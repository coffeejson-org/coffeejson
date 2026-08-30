/**
 * A quantity on the wire: a single `value`, or a `min`/`max` window when the
 * source published one (an espresso yield of 32-34 g). At least one of the three
 * is present; the spec forbids stating both a point and a window.
 */
export interface Measurement {
  value?: number;
  min?: number;
  max?: number;
  unit: string;
}

export interface GearRef {
  id: string;
  brand?: string;
  model?: string;
  label?: string;
}

export interface Grind {
  grinder?: GearRef;
  setting?: string;
  microns_approx?: number;
  /** Qualitative coarseness on the standard perceptual scale (ordered) — a
   *  [`GRIND_SIZES`](./vocabularies.ts) token, or anything a later version adds. */
  size?: string;
}

export interface Step {
  kind?: string;
  at_s?: number;
  to_water?: Measurement;
  instruction?: string;
  label?: string;
  /** How long this step's action takes, in seconds — with per-step pour deltas, this yields pour rate. */
  action_duration_s?: number;
}

export interface Addition {
  /** What is added — an open registry (`ice` marks the recipe iced; unknown values are handled generically). */
  type: string;
  /** Optional: an unquantified addition still states its kind — `ice` with no
   *  amount marks the recipe iced. */
  amount?: Measurement;
  /** Temperature of the added liquid, where meaningful (e.g. milk). */
  temperature?: Measurement;
  /** Free-text detail (brand, prep, sweetener kind). */
  note?: string;
}

export interface Filter {
  /** `paper` retains oils and fines, `metal` lets them through, `cloth` sits
   *  between — a [`FILTER_MATERIALS`](./vocabularies.ts) token, or anything a
   *  later version adds. */
  material: string;
  /** The specific product, as named by the source. */
  label?: string;
}

export interface Recipe {
  /** Document-scoped identifier, so this recipe can be named from outside the
   *  document. A local label, never a global id. */
  id?: string;
  title: string;
  /** One- or two-sentence summary — the preview/snippet text. */
  description?: string;
  method?: string;
  /** Which quantity the brew is stated by — a [`QUANTITY_BASES`](./vocabularies.ts)
   *  token. Absent means `water`. */
  basis?: string;
  brewer?: GearRef;
  coffee: Measurement;
  water?: Measurement;
  yield?: Measurement;
  ratio?: number;
  water_temp?: Measurement;
  grind?: Grind;
  pressure?: Measurement;
  preinfusion_s?: number;
  basket?: GearRef;
  filter?: Filter;
  steps?: Step[];
  finish_s?: number;
  lang?: string;
  /** The publisher's own translations of this recipe's human text, keyed by
   *  BCP-47 tag. Requires `lang`. */
  localizations?: Record<string, RecipeLocalization>;
  bean_ref?: string;
  /** Who authored this recipe — attribution that must survive re-share. */
  author?: Party;
  /** Where this recipe was originally published (schema.org `isBasedOn`). */
  based_on?: string;
  /** Absolute image URLs — a single image is an array of one. */
  images?: string[];
  /** ISO 8601 calendar date this recipe was first published. */
  date_published?: string;
  recommended?: boolean;
  notes?: string;
  additions?: Addition[];
}

/** A person or organization credited on a document — recipe `author`, bean `roaster`,
 *  and each entry of an origin item's `producers`. */
export interface Party {
  name: string;
  /** The party's own page. */
  url?: string;
  /** A [`PARTY_TYPES`](./vocabularies.ts) token; absent → inferred from the crediting
   *  field (author → person, roaster → organization, a party whose role is
   *  farm/cooperative/washing_station/mill → organization). */
  type?: string;
  /** The part this party played, on any credit. An open registry; an unrecognized
   *  role still displays. */
  role?: string;
}

/** One place a coffee grew: the whole of a single origin, or one part of a blend. */
export interface OriginItem {
  name?: string;
  country?: string;
  region?: string;
  producers?: Party[];
  altitude?: Measurement;
  varietals?: string[];
  process?: string[];
  percentage?: number;
  harvest_time?: string;
}

export interface Origin {
  type?: string;
  items?: OriginItem[];
}

/** Days from the roast date, at least one bound. */
export interface RestWindow {
  min?: number;
  max?: number;
}

export interface Bean {
  name?: string;
  roaster?: Party;
  url?: string;
  /** Absolute image URLs — a single image is an array of one. */
  images?: string[];
  origin?: Origin;
  process?: string[];
  rest_days?: RestWindow;
  drying_method?: string;
  varietals?: string[];
  roast_level?: string;
  roast_agtron?: number;
  roast_date?: string;
  production_roaster?: string;
  decaf?: boolean;
  form?: string;
  preferred_extraction?: string;
  certifications?: string[];
  roaster_notes?: string[];
  description?: string;
  lang?: string;
  /** The roaster's own translations of this coffee's human text, keyed by
   *  BCP-47 tag — the bilingual bag. Requires `lang`. */
  localizations?: Record<string, BeanLocalization>;
  id?: string;
}

/** One locale's wording for a recipe. Wording only — every quantity, unit and
 *  enum belongs to the recipe and is the same in every language. */
export interface RecipeLocalization {
  title?: string;
  description?: string;
  notes?: string;
  /** Positional against the base `steps`: entry i translates step i, `{}`
   *  leaves it untranslated. A length mismatch means the whole array is
   *  ignored — a misaligned instruction is worse than an untranslated one. */
  steps?: StepLocalization[];
}

export interface StepLocalization {
  instruction?: string;
  label?: string;
}

/** One locale's wording for a coffee. The coffee's identity — origin, process,
 *  varietals, roast — never varies with the language it is described in. */
export interface BeanLocalization {
  name?: string;
  description?: string;
  /** Replaced whole, never matched item by item: descriptor lists are
   *  rewritten in translation rather than mapped one-to-one. */
  roaster_notes?: string[];
}

/** The software that wrote a document. Informational — consumers must not depend
 *  on it — and a property of the document, not of any recipe. Named around
 *  TypeScript's built-in `Generator`; the wire member is still `generator`. */
export interface DocumentGenerator {
  /** The software's name — an app, a hosted service, a script, a language
   *  model. Required on the wire: a generator naming nothing states nothing. */
  name: string;
  version?: string;
  url?: string;
}

/** The two dial-in axes as the drinker perceived them. Both run -1 to 1 with 0
 *  meaning "about right", and that bipolar scale belongs to these two dimensions
 *  rather than to the member — a future intensity dimension carries its own. */
export interface PerceivedAxes {
  /** -1 sour / under-extracted … 0 balanced … 1 bitter / over-extracted. A
   *  judgment, never a measured extraction yield. */
  extraction?: number;
  /** -1 weak / thin … 0 about right … 1 strong / heavy. */
  strength?: number;
}

/** What an instrument read from the finished beverage — measured fact, kept in
 *  its own member so no consumer can render it as an impression. */
export interface MeasuredCup {
  /** Total dissolved solids as a percentage by mass, off a refractometer. */
  tds?: number;
  /** The beverage mass actually weighed out of this brew — a scale reading of
   *  this cup, as against a recipe's `yield`, which is the mass it aimed at. */
  yield?: Measurement;
}

/** How one brewed cup turned out — never the recipe itself and never a journal
 *  entry: no timestamp, no drinker identity, no inventory state. Its impressions
 *  are attributed to the document's `generator`. */
export interface Tasting {
  /** Document-scoped identifier, so this cup can be named from outside the
   *  document. A local label, never a global id. Not a timestamp. */
  id?: string;
  /** The `id` of the recipe in this document this cup was brewed from. */
  recipe_ref?: string;
  /** The `id` of the bean in this document that was brewed. Wins over the
   *  referenced recipe's own `bean_ref`: brewing someone else's recipe with your
   *  own coffee is a case the format expresses, not a conflict. */
  bean_ref?: string;
  /** 1-5, how much the drinker liked this cup. A producer on another scale maps
   *  to the nearest whole value; one that cannot map omits the field. */
  rating?: number;
  perceived?: PerceivedAxes;
  /** What the drinker tasted, in their own words. Display text carried verbatim,
   *  not ids: two match when equal after folding case and trimming surrounding
   *  whitespace, and by no looser rule. */
  descriptors?: string[];
  note?: string;
  /** BCP-47 tag hinting the language of `note` and `descriptors`. There is no
   *  `localizations` counterpart: nobody translates their own tasting note. */
  lang?: string;
  measured?: MeasuredCup;
}

export interface CoffeeJSONDocument {
  coffeejson: string;
  beans?: Bean[];
  recipes?: Recipe[];
  /** How the brewed cups turned out. A document of tastings alone is invalid —
   *  a tasting evaluates something the document must also carry. */
  tastings?: Tasting[];
  generator?: DocumentGenerator;
}
