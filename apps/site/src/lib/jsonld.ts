import type { DecodedDocument } from "@coffeejson/core";
import { beanJsonLd, recipeJsonLd } from "@coffeejson/core";

/**
 * A document's JSON-LD: every exportable recipe as schema.org Recipe, and — only
 * when the document carries no recipe — every exportable bean as Product. A bean
 * beside a recipe is already inside the Recipe node's ingredient line and has its
 * own page under /beans/; a bean on its own (a roaster's bag, scanned) is the
 * page's whole subject.
 */
export function docJsonLd(doc: DecodedDocument, url?: string): unknown[] {
  const options = url ? { url } : undefined;
  const recipes = (doc.recipes ?? [])
    .map((_, i) => recipeJsonLd(doc, i, options))
    .filter((x): x is Record<string, unknown> => x !== null);
  // Presence, not exportability: an untitled recipe is still what the page is
  // about, and a Product node beside it would describe the wrong subject.
  if ((doc.recipes ?? []).length) return recipes;
  // One page, one subject. Several bags on a page means no single bag owns its
  // URL, so each keeps only its own `sameAs`.
  const beanOptions = (doc.beans ?? []).length === 1 ? options : undefined;
  return (doc.beans ?? [])
    .map((_, i) => beanJsonLd(doc, i, beanOptions))
    .filter((x): x is Record<string, unknown> => x !== null);
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
