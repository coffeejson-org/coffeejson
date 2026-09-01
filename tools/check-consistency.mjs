#!/usr/bin/env node
// Cross-member facts the schema cannot state, checked against the documents.
//
// JSON Schema validates each member against its own rules. It cannot compare
// two siblings, so a document can satisfy every rule and still say something
// that cannot be true. Two of those live in this format.
//
//   1. `ratio` against `coffee` and `water`. Recipe § Ratio makes the
//      measurements authoritative and the ratio a convenience, so a document
//      whose ratio disagrees is CONFORMANT — `fixtures/valid/recipe-ratio-
//      disagrees-with-water.json` exists to say so. What is not conformant is
//      a document WE authored disagreeing with itself, which is a
//      transcription bug wearing a legal shape. Hence the exemption list.
//
//   2. `min` against `max` on any window. Folding the window into the object
//      is what stops a range splitting its unit across two ends; it never
//      ordered them. `{min: 30, max: 15, unit: "gram"}` validates, and so does
//      `rest_days: {min: 30, max: 14}`, which carries no unit at all.
//
// Neither is a value the forward-compatibility contract asks anyone to
// tolerate — that contract covers members and vocabulary values a consumer
// does not recognise, not arithmetic that cannot hold.

/** Exact, per the schema's own `ounce` description. */
const GRAMS_PER_OUNCE = 28.349523125;

/**
 * How far a stated ratio may sit from the measured one.
 *
 * Measured, not guessed: across the 38 ratio comparisons in `fixtures/valid`
 * and `recipes/`, real publisher rounding never exceeds 1.08% (Equator's
 * Origami states 17 for 16.818). The deliberate-disagreement fixture sits at
 * 11.33%. 5% is an order of magnitude above the rounding and less than half
 * the disagreement, so it separates them without resting on either.
 */
const RATIO_TOLERANCE = 0.05;

/** Documents whose self-contradiction is the point. Never grows without a reason beside it. */
const EXEMPT = new Map([
  ["fixtures/valid/recipe-ratio-disagrees-with-water.json", "the disagreeing ratio is what it documents"],
]);

/** Grams, or null when the quantity is not a mass this tool can compare. */
function grams(measure, key) {
  const n = measure?.[key];
  if (typeof n !== "number") return null;
  if (measure.unit === "gram") return n;
  if (measure.unit === "ounce") return n * GRAMS_PER_OUNCE;
  return null; // milliliter: Water quantity declines to define the conversion, and so does this
}

/** Every object carrying a `min`/`max` window, with the path that found it. Unit-bearing or not. */
function* windows(node, path) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) yield* windows(v, `${path}[${i}]`);
    return;
  }
  if ("min" in node || "max" in node) yield [path || "(root)", node];
  for (const [k, v] of Object.entries(node)) yield* windows(v, path ? `${path}.${k}` : k);
}

/** Findings for one parsed document. `label` names the file; `error` is null when clean. */
export function consistencyFindings(file, doc) {
  const findings = [];
  const add = (label, error) => findings.push({ label, error: error ?? null });
  const exemption = EXEMPT.get(file);

  for (const [path, w] of windows(doc, "")) {
    if (typeof w.min === "number" && typeof w.max === "number" && w.min > w.max) {
      add(
        `${file} ${path}`,
        `min ${w.min} is above max ${w.max} — an empty window. Folding the range into the ` +
          `object fixes its unit; it does not order the ends, and nothing else will.`,
      );
    }
  }

  for (const [i, r] of (doc?.recipes ?? []).entries()) {
    const { ratio, coffee, water } = r ?? {};
    if (typeof ratio !== "number" || !coffee || !water) continue;
    // Recipe § Ratio: a coupled window carries ONE ratio that holds at both ends, and
    // `ratio` is the only field that says so — so both ends are checkable, not neither.
    for (const end of ["value", "min", "max"]) {
      const c = grams(coffee, end);
      const w = grams(water, end);
      if (c === null || w === null || c <= 0) continue;
      const measured = w / c;
      if (Math.abs(measured - ratio) / measured <= RATIO_TOLERANCE) continue;
      if (exemption) {
        add(`${file} recipes[${i}].ratio (exempt: ${exemption})`, null);
        continue;
      }
      const where = end === "value" ? "" : ` at the window's ${end}`;
      add(
        `${file} recipes[${i}].ratio`,
        `${ratio} contradicts the measurements${where} (${w.toFixed(1)} / ${c.toFixed(1)} = ` +
          `${measured.toFixed(2)} g/g). The specification makes the measurements authoritative, ` +
          `so this states a number no consumer shows.`,
      );
    }
  }

  if (!findings.length) add(file, null);
  return findings;
}
