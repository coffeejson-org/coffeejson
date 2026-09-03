#!/usr/bin/env node
// An invalid fixture must be rejected FOR THE REASON ITS CATALOG ROW STATES.
//
// `fixtures/README.md` already says why each invalid document must fail, and
// `check-fixture-catalog.mjs` already proves every file has a row. Neither
// proves the file still fails for that reason. A fixture edited so that some
// OTHER rule catches it first is a passing test that has quietly stopped
// testing its subject — the corpus stays green and covers less every year.
//
// The `Fails on` column is that missing link: an ajv keyword, optionally
// narrowed to the member it fired on.
//
//     required:recipes.title    a missing `title` under a recipe
//     enum:coffee.unit          a bad `unit` on the `coffee` measurement
//     false schema:water        a `water` member the schema forbids here
//     anyOf                     a root-level either/or, unqualified
//
// A member name is qualified with its owner when the name recurs across
// objects (`name`, `id`, `unit`, `value`, …), so `author.name` and
// `roaster.name` cannot be confused for one another.

/** Leaf names common enough that a bare one would match the wrong fixture. */
const GENERIC = new Set([
  "value",
  "min",
  "max",
  "unit",
  "name",
  "id",
  "url",
  "type",
  "label",
  "role",
  "title",
]);

/** Path segments that name something, i.e. array indices dropped. */
const named = (instancePath) =>
  instancePath
    .split("/")
    .filter(Boolean)
    .filter((s) => !/^\d+$/.test(s));

/** The member an error fired on, owner-qualified when the name recurs. */
export function leafOf(error) {
  const segs = named(error.instancePath);
  const missing = error.params?.missingProperty;
  if (missing) {
    const owner = segs.at(-1);
    return GENERIC.has(missing) && owner ? `${owner}.${missing}` : missing;
  }
  if (segs.length === 0) return "";
  const last = segs.at(-1);
  const owner = segs.at(-2);
  return GENERIC.has(last) && owner ? `${owner}.${last}` : last;
}

/**
 * Does any reported error match the declared token?
 *
 * Matching is "some error", not "the first error": one broken rule often
 * reports several errors (a failed `anyOf` reports every branch it tried),
 * and which one ajv lists first is not a contract.
 *
 * @param declared  a `Fails on` cell, e.g. `required:recipes.title`
 * @param errors    ajv's `validate.errors`
 */
export function reasonMatches(declared, errors) {
  const cut = declared.indexOf(":");
  const keyword = cut === -1 ? declared : declared.slice(0, cut);
  const leaf = cut === -1 ? "" : declared.slice(cut + 1);
  return (errors ?? []).some(
    (e) => e.keyword === keyword && (leaf === "" || leafOf(e) === leaf),
  );
}

/**
 * The `Fails on` cell for every row of the `## invalid/` table.
 *
 * @param readmeMd  fixtures/README.md content
 * @returns Map<filename, token>
 */
export function declaredReasons(readmeMd) {
  const lines = readmeMd.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## invalid/");
  if (start === -1) return new Map();
  const end = lines.findIndex((l, i) => i > start && /^#{1,6} /.test(l));
  const rows = lines.slice(start + 1, end === -1 ? lines.length : end);

  const reasons = new Map();
  for (const line of rows) {
    const m = line.match(/^\| `([^`]+\.json)` \| `([^`]+)` \|/);
    if (m) reasons.set(m[1], m[2]);
  }
  return reasons;
}
