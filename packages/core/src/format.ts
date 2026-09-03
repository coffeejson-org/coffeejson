import { gearLabelsFor } from "./gear-labels.js";
import type { Measurement } from "./types.js";
import type { Unit } from "./vocabularies.js";
import type { LabelSet } from "./labels.js";
import type { NormalizedOriginItem, NormalizedParty, NormalizedRecipe } from "./normalize.js";
import { defaultLabels } from "./labels.js";
import { round1, roundMeasurement } from "./units.js";

// Keyed by `Unit`, so a unit the schema grows is a compile error here rather
// than a measurement silently rendering as the empty string.
const UNIT_SYMBOLS: Record<Unit, string> = {
  gram: "g", ounce: "oz", milliliter: "mL",
  celsius: "°C", fahrenheit: "°F", bar: "bar", meter: "m", foot: "ft",
};
// The lookup stays open: `unit` is a wire string, and the spec reads an
// unrecognized one as absent rather than throwing.
const UNIT: Record<string, string> = Object.assign(Object.create(null), UNIT_SYMBOLS);

/** `format` renders each magnitude — pass a locale-aware one to localize digits. */
export function fmtMeasurement(m?: Measurement | null, format: (n: number) => string = String): string {
  if (!m) return "";
  const u = UNIT[m.unit];
  if (u === undefined) return "";
  const span = fmtSpan(m, format);
  return span === "" ? "" : `${span} ${u}`;
}

// A window renders as a window ("18.5–19"), never as a midpoint: the spec
// forbids presenting a derived point as the author's number.
function fmtSpan(m: Measurement, format: (n: number) => string): string {
  if (m.value !== undefined) return format(m.value);
  if (m.min !== undefined && m.max !== undefined) return `${format(m.min)}–${format(m.max)}`;
  if (m.min !== undefined) return `${format(m.min)}+`;
  if (m.max !== undefined) return `≤${format(m.max)}`;
  return "";
}

/**
 * A single number to compute with — a window yields its midpoint, a one-sided
 * window its stated bound. Never for display; see `fmtMeasurement`.
 */
export function magnitude(m?: Measurement | null): number | null {
  if (!m) return null;
  if (m.value !== undefined) return m.value;
  if (m.min !== undefined && m.max !== undefined) return (m.min + m.max) / 2;
  return m.min ?? m.max ?? null;
}

export const unitSymbol = (u?: string | null): string => (u && UNIT[u]) || "";

export const fmtClock = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// Every render surface calls this, so the untimed placeholder stays one decision.
export const fmtStepTime = (atS: number | null): string =>
  atS !== null ? fmtClock(atS) : "—";

// Formatting only; the ratio itself is derived in normalize().
export function formatRatio(ratio: number | null): string {
  if (ratio === null) return "";
  const n = Number.isInteger(ratio) ? String(ratio) : ratio.toFixed(1).replace(/\.0$/, "");
  return `1 : ${n}`;
}

// Tolerant: `normalize` feeds it untrusted gear objects straight off the wire.
export function gearLabel(g: unknown, labels: Readonly<Record<string, string>> = gearLabelsFor()): string {
  if (typeof g !== "object" || g === null || Array.isArray(g)) return "";
  const o = g as Record<string, unknown>;
  const id = typeof o["id"] === "string" ? o["id"] : "";
  const label = typeof o["label"] === "string" ? o["label"] : null;
  const brand = typeof o["brand"] === "string" ? o["brand"] : null;
  const model = typeof o["model"] === "string" ? o["model"] : null;
  const brandModel = [brand, model].filter(Boolean).join(" ");
  // Spec order, 03-recipe.md § Gear object: a KNOWN id resolves to the consumer's
  // own label first, because the id is the wire form and the display string is the
  // edge — a document naming registered gear carries none. Only `custom` and an
  // unrecognized id fall back to what the producer wrote.
  const base = (id && id !== "custom" ? labels[id] : undefined)
    ?? label ?? (brandModel || id);
  if (!base) return "";
  // The registry names the family; `variant` names which one of it, and no lookup
  // can supply it — so a consumer that drops it loses what the document knew.
  const variant = typeof o["variant"] === "string" && o["variant"] !== "" ? o["variant"] : null;
  return variant ? `${base} ${variant}` : base;
}

/**
 * One closed vocabulary's label for a token off the wire, which may name a value
 * this build has never heard of. The fallback is the table's own answer, not a
 * policy stated here: a set defining `other` gives it, and one that does not —
 * `roast_level`, grind `size` — gives the empty string, which callers drop.
 */
export const vocabularyLabel = (
  table: Record<string, string>,
  token?: string | null,
): string => {
  if (!token) return "";
  const open = table as Record<string, string | undefined>;
  return open[token] ?? open["other"] ?? "";
};

/**
 * A credited party's role for display. The registry is open and the spec makes
 * showing an unrecognized role a MUST, so the token itself is the fallback —
 * never the empty string a closed set's `vocabularyLabel` gives.
 */
export const roleLabel = (table: Record<string, string>, role?: string | null): string =>
  role ? (table as Record<string, string | undefined>)[role] ?? role : "";

// Reads `labels.ts` because that is the copy `mergeLabels` overrides; a second
// table here could disagree with it, with nothing comparing the two.
export const methodLabel = (m?: string | null): string =>
  vocabularyLabel(defaultLabels.methods, m);

// Intl.DisplayNames#of throws a RangeError on anything that isn't a well-formed
// region subtag, and a mistyped code must not crash.
const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
export function regionLabel(code: string): string {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

// Card text, not a transcript: round to one decimal, and skip a measurement the
// display layer cannot render rather than reduce it to a bare magnitude.
const part = (m: Measurement | null): string | null =>
  m === null ? null : fmtMeasurement(roundMeasurement(m)) || null;

/** One-line recipe summary, for og:description card text. */
export function summary(r: NormalizedRecipe): string {
  const parts: string[] = [];
  const c = part(r.coffee);
  if (c) parts.push(`${c} coffee`);
  const w = part(r.water);
  if (w) parts.push(`${w} water`);
  if (r.ratio !== null) parts.push(`1:${round1(r.ratio)}`);
  const t = part(r.waterTemp);
  if (t) parts.push(t);
  return parts.join(" · ");
}

/** A coffee often states more than one process, and the set reads as a list. */
export const processLine = (tokens: readonly string[], labels: LabelSet): string =>
  tokens.map((t) => vocabularyLabel(labels.processes, t)).filter(Boolean).join(" · ");

/**
 * Everyone credited with growing a lot. A role goes beside the name, never
 * instead of it: an entry the source left roleless is as real as a roled one,
 * and an unrecognized role still shows.
 */
export const producerLine = (parties: readonly NormalizedParty[], labels: LabelSet): string =>
  parties
    .map((p) => {
      const role = roleLabel(labels.producerRoles, p.role);
      return role ? `${p.name} (${role})` : p.name;
    })
    .join(", ");

/**
 * One origin item as a line of facts joined by " · ". `measurement` renders the
 * altitude — pass a config-aware formatter to convert and localize it.
 */
export const originLine = (
  it: NormalizedOriginItem,
  labels: LabelSet,
  measurement: (m: Measurement | null) => string = fmtMeasurement,
): string =>
  [
    it.name,
    [it.region, it.country !== null ? regionLabel(it.country) : null].filter(Boolean).join(", "),
    producerLine(it.producers, labels),
    // Altitude carries its own unit, so it names itself where harvest time and a
    // component's varietals would read as bare numbers and words.
    measurement(it.altitude),
    it.varietals.length > 0 ? `${labels.facts.varietals} ${it.varietals.join(", ")}` : "",
    processLine(it.process, labels),
    it.harvestTime !== null ? `${labels.facts.harvest} ${it.harvestTime}` : "",
    it.percentage !== null ? `${it.percentage}%` : "",
  ].filter(Boolean).join(" · ");
