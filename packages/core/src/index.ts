// @coffeejson/core — types, validation-adjacent helpers, and exporters for
// the CoffeeJSON format (https://coffeejson.org).
// Every type reachable from an exported signature is itself exported: a consumer
// holding a value must be able to name its type without an indexed access.
// `json.ts`, `association.ts` and `inflate.ts` are absent — implementation, not surface.

export type { DecodedDocument, DecodeError, DecodeResult } from "./codec.js";
export {
  checkEnvelope,
  DECODE_ERROR_KINDS,
  decodeDocumentText,
  decodePayload,
  decodeScanned,
  encodePayload,
  MAX_PAYLOAD_BYTES,
  payloadFromLocation,
} from "./codec.js";
export {
  fmtClock,
  fmtMeasurement,
  fmtStepTime,
  formatRatio,
  gearLabel,
  methodLabel,
  originLine,
  processLine,
  producerLine,
  regionLabel,
  roleLabel,
  summary,
  unitSymbol,
  vocabularyLabel,
} from "./format.js";
export { GEAR_LABELS, gearLabelsFor } from "./gear-labels.js";
export { beanJsonLd, recipeJsonLd } from "./jsonld.js";
export type { LabelSet, PartialLabels } from "./labels.js";
export { defaultLabels, mergeLabels } from "./labels.js";
export type {
  NormalizedAddition,
  NormalizedBean,
  NormalizedDoc,
  NormalizedFilter,
  NormalizedGenerator,
  NormalizedGrind,
  NormalizedMeasured,
  NormalizedOriginItem,
  NormalizedParty,
  NormalizedPerceived,
  NormalizedRecipe,
  NormalizedStep,
  NormalizedTasting,
} from "./normalize.js";
export { normalize } from "./normalize.js";
export { safeUrl } from "./safe-url.js";
export { scopeToBean, scopeToRecipe } from "./scope.js";
export type { TimerState } from "./timer.js";
export { hasSchedule, timerState } from "./timer.js";
export type {
  Addition,
  Bean,
  BeanLocalization,
  CoffeeJSONDocument,
  DocumentGenerator,
  Filter,
  GearRef,
  Grind,
  MeasuredCup,
  Measurement,
  Origin,
  OriginItem,
  Party,
  PerceivedAxes,
  Recipe,
  RecipeLocalization,
  RestWindow,
  Step,
  StepLocalization,
  Tasting,
} from "./types.js";
export type { UnitSystem } from "./units.js";
export { convertMeasurement } from "./units.js";
export { FORMAT_VERSION, MEDIA_TYPE, SUPPORTED_MAJOR } from "./version.js";
export type {
  AltitudeUnit,
  BeanForm,
  BrewMethod,
  FilterMaterial,
  GrindSize,
  MassUnit,
  OriginType,
  PartyType,
  PreferredExtraction,
  PressureUnit,
  Process,
  QuantityBasis,
  RecommendedAdditionType,
  RecommendedProducerRole,
  RoastLevel,
  StepKind,
  TemperatureUnit,
  Unit,
  WaterUnit,
} from "./vocabularies.js";
export {
  ALTITUDE_UNITS,
  BEAN_FORMS,
  BREW_METHODS,
  DEFAULT_QUANTITY_BASIS,
  DEFAULT_STEP_KIND,
  FILTER_MATERIALS,
  GRIND_SIZES,
  MASS_UNITS,
  ORIGIN_TYPES,
  PARTY_TYPES,
  PREFERRED_EXTRACTIONS,
  PRESSURE_UNITS,
  PROCESSES,
  QUANTITY_BASES,
  RECOMMENDED_ADDITION_TYPES,
  RECOMMENDED_PRODUCER_ROLES,
  ROAST_LEVELS,
  STEP_KINDS,
  TEMPERATURE_UNITS,
  UNITS,
  WATER_UNITS,
} from "./vocabularies.js";
