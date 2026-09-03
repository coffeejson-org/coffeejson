import { beansBody } from "../src/lib/beans-body";
import { filtersFromSearch } from "../src/lib/filter";
import { jsonLdJson } from "../src/lib/jsonld";
import { recipesBody, recipesJsonLd } from "../src/lib/recipes-body";
import { agentsBody } from "../src/pages/agents";
import { implementationsBody } from "../src/pages/implementations";
import { landingBody } from "../src/pages/landing";
import { showcaseBody } from "../src/pages/showcase";

// The corpus and bean pages have always been written as complete HTML by
// `gen.mjs`. These five were not: they assembled themselves in the browser, so
// anything that runs no JavaScript — which is most crawlers that are not Google —
// received a 2 KB shell with an empty <main> and no page in it.
//
// They are documents. None of them has an event listener, and the one with view
// state (the bags hub, `?roaster=`) keeps its module to re-render for that case.
// So the body is built here at transform time and the shell ships filled.
//
// The recipe directory is here too, and it is the only one whose module still
// re-renders: its filter state lives in the URL. The build writes the unfiltered
// view — what a bare `/recipes/` asks for — and the module attaches behaviour to
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

/** The empty element the build fills. A shell that stops matching gets caught. */
export const SLOT = '<main id="app"></main>';
const HEAD_SLOT = "</head>";

/** Structured data a page wants in its STATIC head, keyed the same way. The
 *  recipe directory used to build this in the browser, where no reader running
 *  none of it could ever see the corpus's schema.org Recipe data. */
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
