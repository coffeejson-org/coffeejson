/** One inline run inside a paragraph or a list item. */
export type Run =
  | string
  | { readonly code: string }
  | { readonly strong: string }
  | { readonly em: string }
  | { readonly text: string; readonly href: string; readonly code?: boolean };

/** One block. Exactly one of the content keys is set. */
export interface Block {
  readonly p?: readonly Run[];
  /** HTML only — markdown has no muted. */
  readonly muted?: boolean;
  /** Page furniture: rendered on `/agents/`, skipped in the markdown. */
  readonly htmlOnly?: boolean;
  readonly ol?: readonly (readonly Run[])[];
  readonly code?: string;
  readonly examples?: boolean;
  readonly pitfalls?: boolean;
}

/** One section. A null heading is the untitled run of intro blocks. */
export interface Section {
  readonly heading: string | null;
  readonly blocks: readonly Block[];
}

export declare const GUIDE: readonly Section[];
/** Every href BOTH surfaces carry, site-relative as authored. */
export declare function guideHrefs(): string[];
/** Every heading below the `<h1>`, in order. */
export declare function guideHeadings(): string[];
/** The guide as page markup, `<h1>` excluded. */
export declare function guideHtml(): string;
/** The guide as markdown sections, no title and no footer. */
export declare function guideMarkdown(siteUrl: string): string;
