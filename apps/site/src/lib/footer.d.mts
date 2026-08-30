export declare const LICENSE_SITE: string;
export declare const LICENSE_CORPUS: string;
export declare const PACKAGES: string;
export declare const QUOTED_PROSE: string;
/** The privacy sentence. True of `analytics.ts`; changing that file changes this. */
export declare const PRIVACY: string;
/** The AI-agents page's extra clause about the crawler posture. */
export declare const CRAWLERS_UNCHANGED: string;
/** The license-and-privacy paragraph, for a footer that also carries links. */
export declare function licenseLine(...clauses: string[]): string;
/** Joins the given license clauses with the privacy sentence, always last. */
export declare function footerHtml(...clauses: string[]): string;
