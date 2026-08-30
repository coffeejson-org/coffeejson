import type { DecodedDocument } from "./codec.js";
import { associatedMember, associatedMembers } from "./association.js";
import { arr, isObj, str } from "./json.js";

// Projections: part of a document as a document of its own. Nothing is invented
// or rewritten; every member travels byte-verbatim. The input is unchecked past
// the envelope, so every read goes through a tolerant reader.
const isDocument = (v: unknown): v is Record<string, unknown> =>
  isObj(v) && typeof v["coffeejson"] === "string";

// Every member comes through, unknown ones included and in source key order,
// because a consumer preserves what it does not recognize on re-share. A `null`
// or `[]` replacement drops the member: `"beans": []` claims "no coffee". The
// result is a `DecodedDocument` and no more — `coffeejson` is a string by the
// guard, each collection is an array or absent, and every element travels unread.
function project(
  doc: Record<string, unknown>,
  replacements: Record<string, unknown[] | null>,
): DecodedDocument {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (!(key in replacements)) {
      out[key] = value;
      continue;
    }
    const projected = replacements[key];
    if (projected && projected.length) out[key] = projected;
  }
  return out as unknown as DecodedDocument;
}

const idOf = (m: unknown): string | null => (isObj(m) ? str(m["id"]) : null);

// Rule in `association.ts`. A tasting's own coffee wins over the recipe's, so the
// recipe's bean alone would hand over a cup whose coffee is missing. Source order,
// so a one-recipe document projects to itself byte for byte.
function beansFor(
  doc: Record<string, unknown>,
  recipe: Record<string, unknown>,
  tastings: readonly unknown[],
): unknown[] {
  const beans = arr(doc["beans"]);
  const wanted = new Set<unknown>(associatedMembers(beans, str(recipe["bean_ref"]), idOf));
  for (const tasting of tastings) {
    const named = associatedMember(beans, isObj(tasting) ? str(tasting["bean_ref"]) : null, idOf);
    if (named !== null) wanted.add(named);
  }
  return beans.filter((b) => wanted.has(b));
}

// Singular where `beansFor` is plural: carrying a tasting whose subject was
// dropped mints a dangling reference in a document that still validates.
function tastingsFor(
  doc: Record<string, unknown>,
  refKey: "recipe_ref" | "bean_ref",
  members: unknown[],
  target: unknown,
): unknown[] {
  return arr(doc["tastings"]).filter((t) => {
    const ref = isObj(t) ? str(t[refKey]) : null;
    return associatedMember(members, ref, idOf) === target;
  });
}

/**
 * One recipe of a document, plus the beans it needs, as a document. `null` when
 * there is no recipe at `index`, so callers decide what out-of-range means. For a
 * one-recipe document this is the identity, byte for byte.
 */
export function scopeToRecipe(doc: unknown, index: number): DecodedDocument | null {
  if (!isDocument(doc)) return null;
  // Indexed against the RAW array: `index` is a position in the caller's own
  // document, so dropping unreadable entries would shift every later one.
  const recipe = arr(doc["recipes"])[index];
  if (!isObj(recipe)) return null;
  const tastings = tastingsFor(doc, "recipe_ref", arr(doc["recipes"]), recipe);
  return project(doc, {
    beans: beansFor(doc, recipe, tastings),
    recipes: [recipe],
    tastings,
  });
}

/**
 * One bean of a document, as a document — the bag without any way to brew it;
 * recipes are dropped, not emptied. This coffee's tastings come along and the
 * other coffees' do not: a lineup would hand over every opinion of every bag.
 */
export function scopeToBean(doc: unknown, index: number): DecodedDocument | null {
  if (!isDocument(doc)) return null;
  const bean = arr(doc["beans"])[index];
  if (!isObj(bean)) return null;
  return project(doc, {
    beans: [bean],
    recipes: null,
    tastings: tastingsFor(doc, "bean_ref", arr(doc["beans"]), bean),
  });
}
