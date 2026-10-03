import { beansBody } from "../src/lib/beans-body";
import { filtersFromSearch } from "../src/lib/filter";
import { jsonLdJson } from "../src/lib/jsonld";
import { recipesBody, recipesJsonLd } from "../src/lib/recipes-body";
import { agentsBody } from "../src/pages/agents";
import { implementationsBody } from "../src/pages/implementations";
import { landingBody } from "../src/pages/landing";
import { showcaseBody } from "../src/pages/showcase";

// `gen.mjs` writes the corpus and bean pages as complete HTML. Left to assemble
// themselves in the browser, these pages reach a reader that runs no JavaScript
// — most crawlers other than Google — as a 2 KB shell with an empty <main>.
//
// They are documents. None of them has an event listener, and the one with view
// state (the bags hub, `?roaster=`) keeps its module to re-render for that case.
// So the body is built here at transform time and the shell ships filled.
//
// The recipe directory is here too, and it is the only one whose module still
// re-renders: its filter state lives in the URL. The build writes the unfiltered
// view — what a bare `/recipes/` asks for — and the module attaches behavior to
// it rather than rebuilding an identical page. The two must agree exactly, or
// hydration wires listeners onto markup the module disagrees with, so a test
// compares them.
export const PRERENDERED: Record<string, () => string> = {
  "index.html": landingBody,
  "showcase/index.html": showcaseBody,
  "implementations/index.html": implementationsBody,
  "agents/index.html": agentsBody,
  "beans/index.html": () => beansBody(),
  "recipes/index.html": () => recipesBody(filtersFromSearch("")),
};

/** The empty element the build fills. `fill` throws on a shell that stops matching. */
export const SLOT = '<main id="app"></main>';
const HEAD_SLOT = "</head>";

/** Structured data for a page's STATIC head, keyed the same way. Built in the
 *  browser, the corpus's schema.org Recipe data never reaches a reader that
 *  runs no JavaScript. */
export const HEAD_JSONLD: Record<string, () => unknown[]> = {
  "recipes/index.html": recipesJsonLd,
};

export function fill(html: string, page: string): string {
  const body = PRERENDERED[page];
  if (!body) return html;
  if (!html.includes(SLOT)) throw new Error(`${page} has no ${SLOT} to fill`);
  let out = html.replace(SLOT, `<main id="app">${body()}</main>`);

  const ld = HEAD_JSONLD[page]?.();
  if (ld?.length) {
    if (!out.includes(HEAD_SLOT))
      throw new Error(`${page} has no ${HEAD_SLOT} to fill`);
    out = out.replace(
      HEAD_SLOT,
      `  <script type="application/ld+json">${jsonLdJson(ld)}</script>\n  ${HEAD_SLOT}`,
    );
  }
  return out;
}

/** Vite plugin. Runs in dev and in build, so local and deployed agree. */
export const prerender = () => ({
  name: "coffeejson:prerender",
  transformIndexHtml: {
    order: "pre" as const,
    handler: (html: string, ctx: { path: string }) =>
      fill(html, ctx.path.replace(/^\//, "")),
  },
});
