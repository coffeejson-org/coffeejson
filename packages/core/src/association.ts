/**
 * The association rule, shared by `recipe.bean_ref`, `tasting.bean_ref`,
 * `tasting.recipe_ref` and `scope.ts`. A reference present → the member whose
 * `id` matches, unresolved leaving the referrer unlinked rather than erroring.
 * A reference absent → EVERY member: co-location links only a single bean, so
 * narrowing a multi-bean document to one would invent a link the source never
 * stated.
 */
export function associatedMembers<T>(
  members: readonly T[],
  ref: string | null,
  idOf: (member: T) => string | null,
): T[] {
  if (members.length === 0) return [];
  if (ref !== null) {
    // Ids are unique within a collection; a document breaking that is malformed,
    // and every reference to the shared id is unresolved rather than a guess at
    // which member was meant.
    const hits = members.filter((m) => idOf(m) === ref);
    return hits.length === 1 ? hits : [];
  }
  return [...members];
}

/**
 * The one member a referrer is about — null unless there is exactly one, since
 * naming one of three candidates invents the link the rule above declines.
 */
export function associatedMember<T>(
  members: readonly T[],
  ref: string | null,
  idOf: (member: T) => string | null,
): T | null {
  const hits = associatedMembers(members, ref, idOf);
  return hits.length === 1 ? hits[0]! : null;
}
