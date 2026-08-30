import type { Measurement } from "./types.js";

/**
 * Tolerant readers: any JSON value in, a typed value or null out. `normalize`,
 * `scope` and `jsonld` all read documents `decodePayload` cast unchecked past
 * the version gate.
 */

export const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
export const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const objItems = (v: unknown): Record<string, unknown>[] => arr(v).filter(isObj);
export const strArr = (v: unknown): string[] =>
  arr(v).filter((x): x is string => typeof x === "string");

/**
 * A date-only member: `YYYY-MM-DD` naming a day the Gregorian calendar has. A
 * string outside that states no day, so a consumer that showed it would be
 * asserting one.
 */
export const calendarDay = (v: unknown): string | null => {
  const s = str(v);
  if (s === null || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  // `setUTCFullYear`, not `Date.UTC`, which reads a two-digit year as 19xx.
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? s : null;
};

/** A party's display name; whitespace-only counts as absent. */
export const partyName = (v: unknown): string | null => {
  if (!isObj(v)) return null;
  const name = str(v["name"])?.trim();
  return name ? name : null;
};

// A unit plus at least one magnitude; missing either, it states nothing.
export const measurement = (v: unknown): Measurement | null => {
  if (!isObj(v)) return null;
  const unit = str(v["unit"]);
  if (unit === null) return null;
  const value = num(v["value"]);
  const min = num(v["min"]);
  const max = num(v["max"]);
  if (value === null && min === null && max === null) return null;
  return {
    ...(value !== null ? { value } : {}),
    ...(min !== null ? { min } : {}),
    ...(max !== null ? { max } : {}),
    unit,
  };
};
