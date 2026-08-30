import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  ALTITUDE_UNITS, BEAN_FORMS, BREW_METHODS, DEFAULT_QUANTITY_BASIS, DEFAULT_STEP_KIND,
  FILTER_MATERIALS, GRIND_SIZES, MASS_UNITS, ORIGIN_TYPES, PARTY_TYPES,
  PREFERRED_EXTRACTIONS, PRESSURE_UNITS, PROCESSES, QUANTITY_BASES,
  RECOMMENDED_ADDITION_TYPES, RECOMMENDED_PRODUCER_ROLES, ROAST_LEVELS, STEP_KINDS,
  TEMPERATURE_UNITS, UNITS, WATER_UNITS,
} from "../src/vocabularies";

// The schema is the source, so the test reads it rather than a second copy —
// and reads the copy the package SHIPS, so the vended tokens and the shipped
// schema are checked against each other. Without this file `vocabularies.ts` is
// a transcription that degrades silently: a token missed here reads as
// "unknown" to every consumer, and nothing fails.
const schema = JSON.parse(
  readFileSync(new URL("../schema/coffeejson-1.0.schema.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const at = (path: string[]): Record<string, unknown> => {
  let node: unknown = schema;
  for (const key of path) {
    expect(node, path.join(".")).toBeTypeOf("object");
    node = (node as Record<string, unknown>)[key];
  }
  expect(node, `${path.join(".")} names nothing`).toBeTypeOf("object");
  return node as Record<string, unknown>;
};

// Order is asserted, not just membership: the arrays are the schema's lists, and
// an ordered scale (`roast_level`, `grind.size`) means something by its order.
const CLOSED: [name: string, tokens: readonly string[], path: string[]][] = [
  ["method", BREW_METHODS, ["$defs", "method"]],
  ["step.kind", STEP_KINDS, ["$defs", "step", "properties", "kind"]],
  ["process", PROCESSES, ["$defs", "process"]],
  ["bean.roast_level", ROAST_LEVELS, ["$defs", "bean", "properties", "roast_level"]],
  ["bean.form", BEAN_FORMS, ["$defs", "bean", "properties", "form"]],
  ["filter.material", FILTER_MATERIALS, ["$defs", "filter", "properties", "material"]],
  ["grind.size", GRIND_SIZES, ["$defs", "grind", "properties", "size"]],
  ["recipe.basis", QUANTITY_BASES, ["$defs", "recipe", "properties", "basis"]],
  ["origin.type", ORIGIN_TYPES, ["$defs", "origin", "properties", "type"]],
  ["party.type", PARTY_TYPES, ["$defs", "party", "properties", "type"]],
  ["bean.preferred_extraction", PREFERRED_EXTRACTIONS, ["$defs", "bean", "properties", "preferred_extraction"]],
  ["massMeasurement.unit", MASS_UNITS, ["$defs", "massMeasurement", "properties", "unit"]],
  ["waterMeasurement.unit", WATER_UNITS, ["$defs", "waterMeasurement", "properties", "unit"]],
  ["tempMeasurement.unit", TEMPERATURE_UNITS, ["$defs", "tempMeasurement", "properties", "unit"]],
  ["pressureMeasurement.unit", PRESSURE_UNITS, ["$defs", "pressureMeasurement", "properties", "unit"]],
  ["altitude.unit", ALTITUDE_UNITS, ["$defs", "altitude", "properties", "unit"]],
];

describe("every closed set is the schema's enum, in the schema's order", () => {
  for (const [name, tokens, path] of CLOSED) {
    test(name, () => {
      expect(at(path)["enum"], name).toEqual([...tokens]);
    });
  }
});

// An open registry has no `enum` to match — any non-empty string is valid — so
// the schema states its recommended set as `examples`, which the harness already
// holds against the prose's recommended list.
describe("every open registry is the schema's recommended set", () => {
  const OPEN: [name: string, tokens: readonly string[], path: string[]][] = [
    ["addition.type", RECOMMENDED_ADDITION_TYPES, ["$defs", "addition", "properties", "type"]],
    ["party.role", RECOMMENDED_PRODUCER_ROLES, ["$defs", "party", "properties", "role"]],
  ];
  for (const [name, tokens, path] of OPEN) {
    test(name, () => {
      const node = at(path);
      expect(node["enum"], `${name} must stay open`).toBeUndefined();
      expect(node["examples"], name).toEqual([...tokens]);
    });
  }
});

test("the step kind a document means when it states none is the schema's default", () => {
  expect(at(["$defs", "step", "properties", "kind"])["default"]).toBe(DEFAULT_STEP_KIND);
  expect(STEP_KINDS).toContain(DEFAULT_STEP_KIND);
});

test("the basis a document means when it states none is the schema's default", () => {
  expect(at(["$defs", "recipe", "properties", "basis"])["default"]).toBe(DEFAULT_QUANTITY_BASIS);
  expect(QUANTITY_BASES).toContain(DEFAULT_QUANTITY_BASIS);
});

// Derived: the assertion is that nothing is lost or invented, not a second
// transcription of the five lists.
test("every unit identifier the five measurement enums define is in UNITS, once", () => {
  const declared = [...MASS_UNITS, ...WATER_UNITS, ...TEMPERATURE_UNITS, ...PRESSURE_UNITS, ...ALTITUDE_UNITS];
  expect([...UNITS].sort()).toEqual([...new Set(declared)].sort());
  expect(UNITS.length).toBe(new Set(UNITS).size);
});

// The sets the schema does NOT declare are as load-bearing as the ones it does:
// a dose stated in millilitres is invalid, deliberately.
test("only brew water accepts a volume", () => {
  expect(WATER_UNITS).toContain("milliliter");
  for (const tokens of [MASS_UNITS, TEMPERATURE_UNITS, PRESSURE_UNITS, ALTITUDE_UNITS])
    expect(tokens).not.toContain("milliliter");
});

test("every set whose fallback is `other` carries the token to fall back to", () => {
  for (const tokens of [BREW_METHODS, STEP_KINDS, PROCESSES, BEAN_FORMS, FILTER_MATERIALS])
    expect(tokens).toContain("other");
  // The two ordered scales have no `other`, and must not grow one: an unknown
  // value there is ignored in favor of a more precise field, never bucketed.
  for (const tokens of [ROAST_LEVELS, GRIND_SIZES]) expect(tokens).not.toContain("other");
});
