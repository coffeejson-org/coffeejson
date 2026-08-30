import { expect, test } from "vitest";
import {
  fmtClock, fmtMeasurement, fmtStepTime, formatRatio, gearLabel, methodLabel, regionLabel,
  unitSymbol,
} from "../src/format";

test("fmtMeasurement renders known units and drops unknown ones", () => {
  expect(fmtMeasurement({ value: 250, unit: "gram" })).toBe("250 g");
  expect(fmtMeasurement({ value: 93, unit: "celsius" })).toBe("93 °C");
  expect(fmtMeasurement({ value: 9, unit: "bar" })).toBe("9 bar");
  expect(fmtMeasurement({ value: 1, unit: "parsec" })).toBe("");
  expect(fmtMeasurement(null)).toBe("");
  expect(fmtMeasurement(undefined)).toBe("");
});

test("fmtClock", () => {
  expect(fmtClock(0)).toBe("0:00");
  expect(fmtClock(135)).toBe("2:15");
});

// One definition on purpose: three render surfaces print a step's time column,
// and a placeholder defined three times is three chances to drift.
test("fmtStepTime renders the clock for a timed step", () => {
  expect(fmtStepTime(0)).toBe("0:00");
  expect(fmtStepTime(135)).toBe("2:15");
});

test("fmtStepTime renders the placeholder for an untimed step", () => {
  expect(fmtStepTime(null)).toBe("—");
});

test("formatRatio: integers plain, fractions to one decimal, .0 stripped, null empty", () => {
  expect(formatRatio(15)).toBe("1 : 15");
  expect(formatRatio(47 / 19)).toBe("1 : 2.5");
  expect(formatRatio(15.04)).toBe("1 : 15");
  expect(formatRatio(null)).toBe("");
});

test("gearLabel: label wins, then brand+model, then id, tolerant of garbage", () => {
  expect(gearLabel({ id: "g1", label: "Comandante" })).toBe("Comandante");
  expect(gearLabel({ id: "b1", brand: "Hario", model: "V60" })).toBe("Hario V60");
  expect(gearLabel({ id: "only-id" })).toBe("only-id");
  expect(gearLabel({})).toBe("");
  expect(gearLabel(undefined)).toBe("");
  expect(gearLabel("junk")).toBe("");
  expect(gearLabel({ brand: 42, model: null, id: true })).toBe("");
});

test("methodLabel maps known slugs, unknown → Other, absent → empty", () => {
  expect(methodLabel("pour_over")).toBe("Pour-over");
  expect(methodLabel("espresso")).toBe("Espresso");
  expect(methodLabel("__proto__")).toBe("Other");
  expect(methodLabel(undefined)).toBe("");
  expect(methodLabel(null)).toBe("");
});

test("unitSymbol is the loose single-symbol lookup used by summary", () => {
  expect(unitSymbol("gram")).toBe("g");
  expect(unitSymbol("parsec")).toBe("");
  expect(unitSymbol(undefined)).toBe("");
});

test("regionLabel resolves ISO codes and passes through junk without throwing", () => {
  expect(regionLabel("CO")).toBe("Colombia");
  expect(regionLabel("Colombia")).toBe("Colombia"); // non-ISO: passthrough, no RangeError
});

test("dictionary lookups are immune to __proto__/constructor keys", () => {
  expect(fmtMeasurement({ value: 1, unit: "__proto__" })).toBe("");
  expect(fmtMeasurement({ value: 1, unit: "constructor" })).toBe("");
  expect(unitSymbol("__proto__")).toBe("");
  expect(methodLabel("__proto__")).toBe("Other");
  expect(methodLabel("constructor")).toBe("Other");
});

// Assembled from the five closed `unit` enums, so a unit the schema gains lands
// here and the suite reports whether the formatter caught up. One the display
// table omits renders as nothing — how a measurement disappears from a card.
const SCHEMA_UNITS = [
  "gram", "ounce", "milliliter", "celsius", "fahrenheit", "bar", "meter", "foot",
] as const;

// Every SCHEMA_UNITS entry must appear: a missing one means the formatter
// deletes that unit.
const EXPECTED_SYMBOL: Record<string, string> = {
  gram: "g", ounce: "oz", milliliter: "mL",
  celsius: "°C", fahrenheit: "°F", bar: "bar", meter: "m", foot: "ft",
};

test("every schema unit renders magnitude and symbol", () => {
  for (const unit of SCHEMA_UNITS) {
    const expected = EXPECTED_SYMBOL[unit];
    // A schema unit with no expected symbol is a formatter gap, not a skip.
    expect(expected, `${unit} has no expected display symbol`).toBeDefined();
    expect(unitSymbol(unit), unit).toBe(expected);
    expect(fmtMeasurement({ value: 12, unit }), unit).toBe(`12 ${expected}`);
    expect(fmtMeasurement({ min: 12, max: 14, unit }), unit).toBe(`12–14 ${expected}`);
  }
});

// The spec forbids converting a volume into a mass — water's density varies with
// temperature — so `milliliter` renders as itself.
test("milliliter renders as a volume, point and window alike", () => {
  expect(fmtMeasurement({ value: 320, unit: "milliliter" })).toBe("320 mL");
  expect(fmtMeasurement({ min: 300, max: 320, unit: "milliliter" })).toBe("300–320 mL");
  expect(unitSymbol("milliliter")).toBe("mL");
});
