import { recipeJsonLd } from "@coffeejson/core";
import type { DecodedDocument } from "@coffeejson/core";

/** Every exportable recipe of a document as schema.org Recipe JSON-LD. */
export function docJsonLd(doc: DecodedDocument, url?: string): unknown[] {
  return (doc.recipes ?? [])
    .map((_, i) => recipeJsonLd(doc, i, url ? { url } : undefined))
    .filter((x): x is Record<string, unknown> => x !== null);
}

/** Serialize for a <script> body: `<` escaped so no string member can close the tag. */
export const jsonLdJson = (objects: unknown[]): string =>
  JSON.stringify(objects.length === 1 ? objects[0] : objects).replace(/</g, "\\u003c");

/** Put the page's JSON-LD in <head> (replacing any previous injection). */
export function injectJsonLd(objects: unknown[]): void {
  document.getElementById("cj-jsonld")?.remove();
  if (objects.length === 0) return;
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "cj-jsonld";
  script.textContent = jsonLdJson(objects);
  document.head.appendChild(script);
}
