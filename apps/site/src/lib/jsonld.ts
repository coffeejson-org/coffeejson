import type { DecodedDocument } from "@coffeejson/core";
import { documentJsonLd } from "@coffeejson/core";

/**
 * A document's JSON-LD for one page. The rule — recipes, or the beans when
 * there is no recipe — is the package's `documentJsonLd`; this is its call
 * site, with the page's URL where there is one.
 */
export function docJsonLd(doc: DecodedDocument, url?: string): unknown[] {
  return documentJsonLd(doc, url ? { url } : undefined);
}

/** Serialize for a <script> body: `<` escaped so no string member can close the tag. */
export const jsonLdJson = (objects: unknown[]): string =>
  JSON.stringify(objects.length === 1 ? objects[0] : objects).replace(
    /</g,
    "\\u003c",
  );

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
