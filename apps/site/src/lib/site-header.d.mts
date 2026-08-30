export declare const GITHUB_URL: string;
/** `[href, label]` per nav destination, in the order they render. */
export declare const NAV: readonly (readonly [string, string])[];
/** The masthead for a page whose own href is `current` ("/" at home). */
export declare function siteHeader(current: string): string;
