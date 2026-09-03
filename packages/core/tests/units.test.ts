import { expect, test } from "vitest";
import { convertMeasurement } from "../src/units";

test("as-authored is identity", () => {
  expect(
    convertMeasurement({ value: 15, unit: "gram" }, "as-authored"),
  ).toEqual({ value: 15, unit: "gram" });
});
test("metric: ounce→gram, fahrenheit→celsius; gram/celsius unchanged", () => {
  expect(convertMeasurement({ value: 1, unit: "ounce" }, "metric")).toEqual({
    value: 28.3,
    unit: "gram",
  });
  expect(
    convertMeasurement({ value: 200, unit: "fahrenheit" }, "metric"),
  ).toEqual({ value: 93.3, unit: "celsius" });
  expect(convertMeasurement({ value: 15, unit: "gram" }, "metric")).toEqual({
    value: 15,
    unit: "gram",
  });
});
test("imperial: gram→ounce, celsius→fahrenheit", () => {
  expect(
    convertMeasurement({ value: 28.349523125, unit: "gram" }, "imperial"),
  ).toEqual({ value: 1, unit: "ounce" });
  expect(
    convertMeasurement({ value: 93, unit: "celsius" }, "imperial"),
  ).toEqual({ value: 199.4, unit: "fahrenheit" });
});
test("non-mass/temp units pass through unchanged in every system", () => {
  for (const sys of ["metric", "imperial"] as const) {
    expect(convertMeasurement({ value: 9, unit: "bar" }, sys)).toEqual({
      value: 9,
      unit: "bar",
    });
    expect(convertMeasurement({ value: 700, unit: "micron" }, sys)).toEqual({
      value: 700,
      unit: "micron",
    });
  }
});

// 04-bean.md § Altitude makes converting a recognized altitude unit a consumer
// MUST, and `ALTITUDE_UNITS` is meter and foot.
test("altitude converts between meter and foot", () => {
  expect(convertMeasurement({ value: 6200, unit: "foot" }, "metric")).toEqual({
    value: 1889.8,
    unit: "meter",
  });
  expect(
    convertMeasurement({ value: 1900, unit: "meter" }, "imperial"),
  ).toEqual({ value: 6233.6, unit: "foot" });
  expect(convertMeasurement({ value: 1900, unit: "meter" }, "metric")).toEqual({
    value: 1900,
    unit: "meter",
  });
  expect(
    convertMeasurement({ min: 1600, max: 1900, unit: "meter" }, "imperial"),
  ).toEqual({ min: 5249.3, max: 6233.6, unit: "foot" });
});
