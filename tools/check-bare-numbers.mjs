#!/usr/bin/env node
// The bare-number roster, frozen.
//
// A quantity travels as a `{value, unit}` Measurement when producers state it
// in different units, because the unit choice is real information. A quantity
// with a single canonical unit travels as a bare number whose NAME carries the
// unit (Recipe § Measurement object). That line is the format's, and it is
// easy to cross without noticing: a new `_s` field looks like the ones beside
// it, and nothing asks what unit it is in until a consumer guesses wrong.
//
// So the roster below is the whole set of numbers outside a Measurement, and
// this check fails on anything not in it. Adding a field means adding a line
// here and saying what the number means — in review, not after release.
//
// It may shrink, never grow: a stale entry fails too, so promoting a bare
// number to a Measurement forces its line out.

/** Every numeric member outside a Measurement, and what its magnitude means. */
export const BARE_NUMBERS = {
  // The name carries the unit.
  "recipe.preinfusion_s": "seconds",
  "recipe.finish_s": "seconds",
  "step.at_s": "seconds, from the start of the brew",
  "step.action_duration_s": "seconds the action itself takes",
  "grind.microns_approx": "microns",
  "bean.rest_days.min": "days after roast",
  "bean.rest_days.max": "days after roast",

  // Dimensionless. The scale is declared in the specification, never inferred.
  "recipe.ratio": "water / coffee, by mass",
  "originItem.percentage": "percent of the blend, by mass",
  "tasting.measured.tds": "percent by mass, refractometer",
  "tasting.rating": "1-5, the scale this format declares",
  "tasting.perceived.extraction": "-1..1, sour to bitter, 0 balanced",
  "tasting.perceived.strength": "-1..1, weak to strong, 0 balanced",
  "bean.roast_agtron": "Agtron number, whole-bean scale",
};

/** Members of a Measurement — magnitudes governed by their sibling `unit`. */
const MEASUREMENT_MEMBERS = new Set(["value", "min", "max"]);

const isMeasurement = (def) =>
  def?.type === "object" &&
  def.required?.includes("unit") &&
  Array.isArray(def.properties?.unit?.enum);

/**
 * The subschemas that constrain the SAME instance as their parent, so a member
 * declared inside one is a member of the object that carries them. A number
 * conditioned on the brew method lives under `allOf[0].then.properties`, and a
 * walk that only knew `properties` would never see it.
 */
const subschemas = (node) => {
  const out = [];
  for (const key of [
    "if",
    "then",
    "else",
    "not",
    "items",
    "contains",
    "additionalProperties",
    "unevaluatedItems",
    "unevaluatedProperties",
  ])
    if (node[key] && typeof node[key] === "object") out.push(node[key]);
  for (const key of ["allOf", "anyOf", "oneOf", "prefixItems"])
    for (const sub of Array.isArray(node[key]) ? node[key] : [])
      if (sub && typeof sub === "object") out.push(sub);
  for (const key of ["dependentSchemas", "patternProperties"])
    for (const sub of Object.values(node[key] ?? {}))
      if (sub && typeof sub === "object") out.push(sub);
  return out;
};

/**
 * Every numeric member of the schema that is not inside a Measurement.
 *
 * @param schema  the parsed runtime schema
 * @returns string[] of dotted paths, e.g. `recipe.preinfusion_s`
 */
export function bareNumbers(schema) {
  const found = [];
  const walk = (node, path, inMeasurement) => {
    if (!node || typeof node !== "object") return;
    for (const [key, def] of Object.entries(node.properties ?? {})) {
      if (typeof def !== "object" || def === null) continue;
      const here = path ? `${path}.${key}` : key;
      const numeric = def.type === "number" || def.type === "integer";
      if (numeric && !(inMeasurement && MEASUREMENT_MEMBERS.has(key)))
        found.push(here);
      walk(def, here, inMeasurement || isMeasurement(def));
    }
    // An applicator names no member of its own, so the path does not deepen.
    for (const sub of subschemas(node)) walk(sub, path, inMeasurement);
  };
  // A Measurement def is walked like any other, carrying the flag that spares
  // its own magnitude members — never skipped, or a bare number beside `value`
  // would be the one place this check does not look.
  for (const [name, def] of Object.entries(schema.$defs ?? {}))
    walk(def, name, isMeasurement(def));
  walk(schema, "", false);
  return [...new Set(found)].sort();
}

/**
 * @param schema  the parsed runtime schema
 * @returns [{ label, error }] — error null on pass
 */
export function bareNumberFindings(schema) {
  const findings = [];
  const actual = new Set(bareNumbers(schema));
  const rostered = new Set(Object.keys(BARE_NUMBERS));

  for (const path of actual) {
    findings.push({
      label: `${path} is on the roster`,
      error: rostered.has(path)
        ? null
        : "a bare number the roster does not name — add it with what its " +
          "magnitude means, or give it a unit and make it a Measurement",
    });
  }
  for (const path of rostered) {
    if (!actual.has(path))
      findings.push({
        label: `${path} still exists`,
        error:
          "on the roster but not in the schema — drop the line; " +
          "the roster may shrink, never grow",
      });
  }
  return findings;
}
