/** HTML-escape for `innerHTML` glue, all five entities — safe in an attribute. */
export declare function esc(s: unknown): string;
/** The site's one URL slug: Unicode letters and digits, everything else a hyphen. */
export declare function slugify(s: string): string;
/** `${n} ${word}` with a naive English s-plural. */
export declare function plural(n: number, word: string): string;
