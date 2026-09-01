import type { BeanEntry, IndexEntry } from "../src/lib/filter";

/** One catalog entry paired with its validated document, in catalog order. */
export interface CorpusDoc {
  entry: { slug: string; attribution: { source_label: string; transcribed: string } };
  doc: unknown;
}
/** One entry PER RECIPE — a document carrying several yields several cards. */
export declare function buildIndex(corpus?: readonly CorpusDoc[]): IndexEntry[];
/** Projects the corpus by bag. Takes an explicit corpus so the rules are testable. */
export declare function buildBeansIndex(corpus?: readonly CorpusDoc[]): BeanEntry[];
export declare function encodePayload(doc: unknown): string;

export declare const SITE_URL: string;
/** The trailing-slash share prefix the site emits. */
export declare const SHARE_PATH: string;
/** The indexable URL set — both the sitemap and the robots test derive from it. */
export declare const INDEXABLE_PATHS: readonly string[];
export declare function indexableUrls(): string[];
export declare function buildSitemap(urls?: readonly string[]): string;
export declare function buildLlmsTxt(): string;
export declare function buildLlmsFullTxt(read?: (path: string) => string): string;

/** One generated page per corpus DOCUMENT — the counterpart to buildIndex's per-recipe cards. */
export interface CorpusPage {
  slug: string;
  /** `/recipes/<slug>/` — the canonical, and the directory the file is written to. */
  path: string;
  html: string;
}
export declare function corpusPagePath(slug: string): string;
/** Document slugs that produce at least one recipe card, in catalog order. */
export declare function corpusPageSlugs(index?: readonly IndexEntry[]): string[];
export declare function corpusPageUrls(index?: readonly IndexEntry[]): string[];
/** The hand-written pages plus every corpus AND bean page — what the sitemap advertises. */
export declare function allIndexableUrls(
  index?: readonly IndexEntry[],
  beans?: readonly BeanEntry[],
): string[];
export declare function corpusPageMeta(
  entry: CorpusDoc["entry"],
  doc: unknown,
): { title: string; description: string };
export declare function buildCorpusPage(
  entry: CorpusDoc["entry"],
  doc: unknown,
): string;
export declare function buildCorpusPages(
  corpus?: readonly CorpusDoc[],
  index?: readonly IndexEntry[],
): CorpusPage[];

/**
 * The bean half of the corpus: one page per bean IDENTITY, not per document.
 *
 * `beanPageSlug` throws (via the build's `die`) on a roaster absent from the
 * table, and on a non-Latin bean name whose document slug cannot supply the
 * bean half — both are cases where inventing an answer is worse than stopping.
 */
export declare function beanPageSlug(
  roasterName: string,
  beanName: string,
  docSlugs?: readonly string[],
): string;
export declare function beanPagePath(slug: string): string;
export declare function beanPageSlugs(beans?: readonly BeanEntry[]): string[];
export declare function beanPageUrls(beans?: readonly BeanEntry[]): string[];
export declare function buildBeanPage(bean: BeanEntry): string;
/** Throws on a slug collision rather than letting one page overwrite another. */
export declare function buildBeanPages(beans?: readonly BeanEntry[]): CorpusPage[];

/** Blob-URL base for repo paths the site does not serve. */
export declare const GITHUB_BLOB: string;
/** The off-host links llms.txt carries: the skills repository and its three skills. */
export declare const SKILLS_LINKS: readonly (readonly [string, string, string])[];
/** Every markdown path served under /docs/ — the set link rewriting keeps relative-free. */
export declare const SERVED_MD: readonly string[];
export declare function rewriteDocLinks(markdown: string, docPath: string): string;
