// @coffeejson/core — types, validation-adjacent helpers, and exporters for
// the CoffeeJSON format (https://coffeejson.org).
// Every type reachable from an exported signature is itself exported: a consumer
// holding a value must be able to name its type without an indexed access.
// `json.ts`, `association.ts` and `inflate.ts` are absent — implementation, not surface.
export type {
  Addition, Bean, BeanLocalization, CoffeeJSONDocument, DocumentGenerator, Filter, GearRef,
  Grind, Measurement, MeasuredCup, Origin, OriginItem, Party, PerceivedAxes, Recipe,
  RecipeLocalization, RestWindow, Step, StepLocalization, Tasting,
} from "./types.js";
export { recipeJsonLd } from "./jsonld.js";
export {
  DECODE_ERROR_KINDS, MAX_PAYLOAD_BYTES, checkEnvelope, decodePayload, decodeScanned,
  encodePayload, payloadFromLocation,
} from "./codec.js";
export type { DecodeError, DecodeResult, DecodedDocument } from "./codec.js";
export { FORMAT_VERSION, MEDIA_TYPE, SUPPORTED_MAJOR } from "./version.js";
export {
  fmtClock, fmtMeasurement, fmtStepTime, formatRatio, gearLabel, methodLabel, originLine,
  processLine, producerLine, regionLabel, roleLabel, summary, unitSymbol, vocabularyLabel,
} from "./format.js";
export { safeUrl } from "./safe-url.js";
export { scopeToBean, scopeToRecipe } from "./scope.js";
export { convertMeasurement } from "./units.js";
export type { UnitSystem } from "./units.js";
export {
  ALTITUDE_UNITS, BEAN_FORMS, BREW_METHODS, DEFAULT_QUANTITY_BASIS, DEFAULT_STEP_KIND,
  FILTER_MATERIALS, GRIND_SIZES, MASS_UNITS, ORIGIN_TYPES, PARTY_TYPES,
  PREFERRED_EXTRACTIONS, PRESSURE_UNITS, PROCESSES, QUANTITY_BASES,
  RECOMMENDED_ADDITION_TYPES, RECOMMENDED_PRODUCER_ROLES, ROAST_LEVELS, STEP_KINDS,
  TEMPERATURE_UNITS, UNITS, WATER_UNITS,
} from "./vocabularies.js";
export type {
  AltitudeUnit, BeanForm, BrewMethod, FilterMaterial, GrindSize, MassUnit, OriginType,
  PartyType, PreferredExtraction, PressureUnit, Process, QuantityBasis,
  RecommendedAdditionType, RecommendedProducerRole, RoastLevel, StepKind, TemperatureUnit,
  Unit, WaterUnit,
} from "./vocabularies.js";
export { defaultLabels, mergeLabels } from "./labels.js";
export type { LabelSet, PartialLabels } from "./labels.js";
export { normalize } from "./normalize.js";
export type {
  NormalizedAddition, NormalizedBean, NormalizedDoc, NormalizedFilter, NormalizedGenerator,
  NormalizedGrind, NormalizedMeasured, NormalizedOriginItem, NormalizedParty,
  NormalizedPerceived, NormalizedRecipe, NormalizedStep, NormalizedTasting,
} from "./normalize.js";
export { hasSchedule, timerState } from "./timer.js";
export type { TimerState } from "./timer.js";
