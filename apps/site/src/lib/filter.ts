import { slugify } from "./text.mjs";

export interface IndexEntry {
  /** The source document's slug — shared by every card that document produces. */
  slug: string;
  /**
   * This card's own identity: the slug itself while the document holds one
   * recipe, `slug#n` once it holds several. Card DOM ids and the share controls
   * key off this; `slug` still keys the document (`?s=`, download filename).
   */
  id: string;
  /** How many recipes the source document carries — NOT 1 everywhere, and both
   *  the card's "one of N" line and the share controls read it rather than assume. */
  siblings: number;
  title: string;
  /** The document's `author` party, as the projection words it. */
  author: { name: string; url?: string };
  method: string;
  methodLabel: string;
  coffee: string;
  brew: string;
  ratio: string;
  temp: string;
  totalTime: string;
  stepCount: number;
  attribution: {
    source_url: string;
    source_label: string;
    transcribed: string;
  };
  payload: string;
}
/**
 * One bag, derived at build time from the beans the corpus documents carry (see
 * `buildBeansIndex` in tools/gen.mjs). Facts come from a single winning instance,
 * never merged, and the display strings are precomputed there.
 */
export interface BeanEntry {
  /** `slugify(roaster.name)/slugify(name)` — the dedupe identity. */
  key: string;
  name: string;
  roaster: { name: string; url?: string };
  /** The bag's own page, where the transcription named one. */
  url?: string;
  origin: string;
  process: string;
  roast: string;
  notes: string;
  /** Corpus recipes brewed with this bag, in catalog order. */
  recipes: { slug: string; title: string; methodLabel: string }[];
  /** The winning bean re-enveloped as its own document — what this card shares. */
  payload: string;
}

/** Which lens `/recipes` is showing. `recipes` is the default and stays out of the URL. */
export type View = "recipes" | "beans";

export interface Filters {
  view: View;
  q: string;
  author: string | null;
  method: string | null;
}

export function filterEntries(entries: IndexEntry[], f: Filters): IndexEntry[] {
  const q = f.q.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (!q ||
        [e.title, e.author.name, e.method, e.methodLabel].some((v) =>
          v.toLowerCase().includes(q),
        )) &&
      (!f.author || slugify(e.author.name) === f.author) &&
      (!f.method || e.method === f.method),
  );
}

/**
 * `author` reuses the recipe view's chip slug space — there the transcription's
 * author, here the bag's roaster — which is what lets a chip survive a view
 * switch. `method` is a recipe fact and has no meaning over bags.
 */
export function filterBeans(entries: BeanEntry[], f: Filters): BeanEntry[] {
  const q = f.q.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (!q ||
        [e.name, e.roaster.name, e.origin, e.notes].some((v) =>
          v.toLowerCase().includes(q),
        )) &&
      (!f.author || slugify(e.roaster.name) === f.author),
  );
}

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search);
  return {
    view: p.get("view") === "beans" ? "beans" : "recipes",
    q: p.get("q") ?? "",
    author: p.get("author"),
    method: p.get("method"),
  };
}

export function searchFromFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.view !== "recipes") p.set("view", f.view);
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.author) p.set("author", f.author);
  if (f.method) p.set("method", f.method);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * Switching lens carries the query and the roaster/author chip across — both mean
 * something on either side — and drops `method`, which would silently re-apply
 * itself on the way back.
 */
export const withView = (f: Filters, view: View): Filters => ({
  ...f,
  view,
  method: null,
});
