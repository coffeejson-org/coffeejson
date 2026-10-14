import { encodePayload, normalize } from "@coffeejson/core";
import { elementScriptUrl } from "./element-url.mjs";
import { esc } from "./text.mjs";

/** The viewer a pasted card's Open link and fallback link point at. Frozen on
 *  every page that pastes the snippet, so it is spelled the way the label
 *  sheets spell it. */
export const EMBED_VIEWER = "https://coffeejson.org/r/";

/** What a reader calls the document: the bag's name when it has a bag, else the
 *  recipe's title. */
export function documentTitle(doc: unknown): string {
  const { beans, recipes } = normalize(doc);
  const bean = beans[0]?.name ?? null;
  const recipe = recipes[0]?.title ?? null;
  return (bean ?? recipe ?? "A coffee").trim() || "A coffee";
}

/** Whether the snippet sets `jsonld` unless the reader says otherwise. A recipe
 *  on its own adds a `Recipe` node no page already has; a bag is usually on a
 *  shop page whose theme already describes the product. */
export function jsonLdByDefault(doc: unknown): boolean {
  const { beans, recipes } = normalize(doc);
  return recipes.length > 0 && beans.length === 0;
}

export interface SnippetOptions {
  version: string;
  jsonld: boolean;
}

/** The four lines a page author pastes. Every value is escaped for an attribute. */
export function embedSnippet(doc: unknown, opts: SnippetOptions): string {
  const d = esc(encodePayload(doc));
  const jsonld = opts.jsonld ? " jsonld" : "";
  return [
    `<script type="module" src="${esc(elementScriptUrl(opts.version))}"></script>`,
    `<coffee-json d="${d}" viewer="${EMBED_VIEWER}" viewer-label="Open"${jsonld}>`,
    `  <a href="${EMBED_VIEWER}?d=${d}">${esc(documentTitle(doc))}, as CoffeeJSON</a>`,
    `</coffee-json>`,
  ].join("\n");
}
