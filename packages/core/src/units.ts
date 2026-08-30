import type { Measurement } from "./types.js";
import type { AltitudeUnit, MassUnit, TemperatureUnit } from "./vocabularies.js";

export type UnitSystem = "as-authored" | "metric" | "imperial";

// Checked against the vended sets, so a rename in the schema lands here as a
// compile error rather than a comparison that quietly stops matching.
const GRAM = "gram" satisfies MassUnit;
const OUNCE = "ounce" satisfies MassUnit;
const CELSIUS = "celsius" satisfies TemperatureUnit;
const FAHRENHEIT = "fahrenheit" satisfies TemperatureUnit;
const METER = "meter" satisfies AltitudeUnit;
const FOOT = "foot" satisfies AltitudeUnit;

export const round1 = (n: number): number => Math.round(n * 10) / 10;
const GRAMS_PER_OUNCE = 28.349523125;
const METERS_PER_FOOT = 0.3048;

// Unrounded: formatters own display rounding, not the derivations calling this.
export function convertMassValue(value: number, from: string, to: string): number | null {
  if (from === to) return value;
  if (from === GRAM && to === OUNCE) return value / GRAMS_PER_OUNCE;
  if (from === OUNCE && to === GRAM) return value * GRAMS_PER_OUNCE;
  return null;
}

// A window converts bound by bound, so a 32-34 g yield stays a window in ounces.
export const mapMagnitudes = (m: Measurement, f: (n: number) => number, unit: string): Measurement => ({
  ...(m.value !== undefined ? { value: round1(f(m.value)) } : {}),
  ...(m.min !== undefined ? { min: round1(f(m.min)) } : {}),
  ...(m.max !== undefined ? { max: round1(f(m.max)) } : {}),
  unit,
});

/** Each magnitude rounded to one decimal, unit unchanged. */
export const roundMeasurement = (m: Measurement): Measurement => mapMagnitudes(m, (n) => n, m.unit);

// Mass (gram⇄ounce), temperature (celsius⇄fahrenheit) and length (meter⇄foot)
// convert; every other unit passes through untouched. Length is here because
// 04-bean.md makes converting a recognized altitude unit a consumer MUST.
export function convertMeasurement(m: Measurement, system: UnitSystem): Measurement {
  if (system === "as-authored") return m;
  const toMetric = system === "metric";
  switch (m.unit) {
    case OUNCE:
      return toMetric ? mapMagnitudes(m, (n) => n * GRAMS_PER_OUNCE, GRAM) : m;
    case GRAM:
      return toMetric ? m : mapMagnitudes(m, (n) => n / GRAMS_PER_OUNCE, OUNCE);
    case FAHRENHEIT:
      return toMetric ? mapMagnitudes(m, (n) => (n - 32) * 5 / 9, CELSIUS) : m;
    case CELSIUS:
      return toMetric ? m : mapMagnitudes(m, (n) => n * 9 / 5 + 32, FAHRENHEIT);
    case FOOT:
      return toMetric ? mapMagnitudes(m, (n) => n * METERS_PER_FOOT, METER) : m;
    case METER:
      return toMetric ? m : mapMagnitudes(m, (n) => n / METERS_PER_FOOT, FOOT);
    // milliliter has no defined mass conversion: water's density varies with
    // temperature, so it passes through in every system, like bar.
    default:
      return m;
  }
}
