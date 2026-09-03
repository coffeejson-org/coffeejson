// A `.mjs` with a `.d.mts` beside it, matching `tools/gen.d.mts`, because two
// runtimes read it: the page modules are TypeScript built by vite, and
// `tools/gen.mjs` is plain Node. A `.ts` module reaches only half the pages, and
// the sentence below is then hand-copied into the other half.

/** License line for the hand-written pages, which cover more than the corpus. */
export const LICENSE_SITE =
  "Spec, schema and corpus: CC0 1.0 Universal — public domain.";
/** License line for the corpus and agent pages, which are the CC0 artifacts themselves. */
export const LICENSE_CORPUS = "CC0 1.0 Universal — public domain.";
export const PACKAGES = "Packages: Apache-2.0.";
/** Wherever a page can show quoted roaster copy, the quotation's owner is named. */
export const QUOTED_PROSE = "Quoted roaster prose remains its author’s.";
/**
 * Naming the owner is half of it; the other half is a way to reach us. Every
 * page that shows quoted material carries this, including the per-recipe and
 * per-bag pages a search engine sends someone to directly — those are where a
 * roaster meets their own words, and a promise they have to leave the site to
 * find is not one they will find.
 */
export const CORRECTIONS =
  "Spot an error, or want your material corrected or removed? " +
  '<a href="https://github.com/coffeejson-org/coffeejson/issues" rel="noopener">' +
  "Open an issue or a PR</a> — both are honored.";

/**
 * The privacy sentence — true of `src/lib/analytics.ts` and of nothing else.
 * Every claim in it is a configured option there, so changing that file changes
 * this sentence.
 */
export const PRIVACY =
  "Privacy-friendly analytics — no cookies, no cross-site tracking, no ad networks.";

/**
 * For the AI-agents page alone, printed under the robots.txt paragraph: an agent
 * must not have to work out whether the crawler posture moved with this one.
 */
export const CRAWLERS_UNCHANGED =
  "The robots.txt posture is unchanged: bulk training crawlers are still asked away, search and retrieval still welcome.";

/**
 * The license-and-privacy paragraph on its own, for the pages whose footer is a
 * row of links rather than a sentence. The privacy sentence is appended here
 * rather than passed in, so a page cannot get this line without it.
 *
 * @param {...string} clauses
 * @returns {string}
 */
export const licenseLine = (...clauses) =>
  `<p class="muted">${[...clauses, PRIVACY].join(" ")}</p>`;

/**
 * The whole footer, for the pages whose footer is only that paragraph.
 *
 * @param {...string} clauses
 * @returns {string}
 */
export const footerHtml = (...clauses) =>
  `<footer>${licenseLine(...clauses)}</footer>`;
