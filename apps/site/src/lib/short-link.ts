// `/r/?s=<slug>` — the site-hosted short form a /recipes card prints as its QR, so
// the code stays sparse. A HOST FEATURE, NOT TRANSPORT: `?d=` stays the canonical
// self-contained binding, and `?s=` resolves only while this site serves the
// corpus. `&i=N` names ONE recipe, 1-based to match the card's `slug#n` id, and
// rides `?s=` because a modifier on `?d=` would change what a link yields for
// consumers that ignore it.

export interface CorpusEntry {
  slug: string;
  payload: string;
}

/** Whole-document payloads by slug, for the publications a card does not carry whole. */
export type DocumentIndex = Record<string, string>;

export interface ShortLink {
  slug: string;
  /** 1-based card position within the document, or null for the whole publication. */
  index: number | null;
}

/** The `s`/`i` pair in a location search string, or null when there is no slug. */
export function shortLinkFromSearch(search: string): ShortLink | null {
  const params = new URLSearchParams(search);
  const slug = params.get("s");
  if (!slug) return null;
  const raw = params.get("i");
  // A malformed `i` resolves the whole publication: the slug is still a real
  // address, and refusing it turns a typo into a dead link.
  const index = raw !== null && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : null;
  return { slug, index };
}

/** The `s` slug alone — for callers that only need to know which document. */
export const slugFromSearch = (search: string): string | null =>
  shortLinkFromSearch(search)?.slug ?? null;

/**
 * What a short link resolves to. Without `index`: the whole publication, or the
 * first card where that is the document byte-for-byte. With `index`: that
 * card's scoped payload; an index past the end resolves to nothing rather than
 * to the publication, so nobody receives three recipes who asked for a fourth.
 */
export function payloadForShortLink(
  cards: readonly CorpusEntry[],
  documents: DocumentIndex,
  link: ShortLink,
): string | null {
  const mine = cards.filter((e) => e.slug === link.slug);
  if (mine.length === 0) return null;
  if (link.index === null) return documents[link.slug] ?? mine[0]!.payload;
  return mine[link.index - 1]?.payload ?? null;
}
