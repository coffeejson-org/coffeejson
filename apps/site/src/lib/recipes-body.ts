import { decodePayload } from "@coffeejson/core";
import rawBeans from "../generated/beans-index.json";
import rawIndex from "../generated/recipes-index.json";
import { BAGS_INTRO, bagSections } from "./bag-rows";
import type { BeanEntry, Filters, IndexEntry, View } from "./filter";
import { filterBeans, filterEntries } from "./filter";
import {
  LICENSE_SITE,
  PACKAGES,
  QUOTED_PROSE,
  CORRECTIONS as SHARED_CORRECTIONS,
  siteFooter,
} from "./footer.mjs";
import { docJsonLd } from "./jsonld";
import { corpusScale, overlayFigure, recipeGlyph } from "./pour-curve.mjs";
import { siteHeader } from "./site-header.mjs";
import { esc, slugify } from "./text.mjs";

// The recipe directory's markup, as a value. The build writes the unfiltered
// view into the shell and the page module attaches behaviour to it, so this
// file must stay reachable from Node: no `location`, no `document`, no state of
// its own. Everything that reads the URL or touches the DOM is in
// `pages/recipes.ts`, which is the only reason the two are separate files.

export const index = rawIndex as IndexEntry[];
// Two lenses over ONE corpus: the bean index is derived at build time from the
// beans these same documents already carry. No bean card invents a document.
const beans = rawBeans as BeanEntry[];

// Every row's glyph is drawn to one scale, so the rows can be compared: a
// short brew is a short curve, a small brew a small square.
const SCALE = corpusScale(index);

const authors = [
  ...new Map(index.map((e) => [slugify(e.author.name), e.author])).entries(),
];
const methods = [
  ...new Map(index.map((e) => [e.method, e.methodLabel])).entries(),
];
// The bean view's chips are roasters, but they ride the same `author` filter key
// and the same slug space — which is what lets a chip survive a view switch.
const roasters = [
  ...new Map(beans.map((b) => [slugify(b.roaster.name), b.roaster])).entries(),
].sort((a, b) => a[1].name.localeCompare(b[1].name));

// A chip says how many it would show beside the other filters in force, and
// is disabled when that is none: a click must never lead to an empty list.
function chip(
  kind: "author" | "method",
  value: string,
  label: string,
  on: boolean,
  count: number,
): string {
  return `<button class="chip${on ? " chip--on" : ""}" data-kind="${kind}" data-value="${esc(value)}"
    aria-pressed="${on}"${count === 0 && !on ? " disabled" : ""}>${esc(label)} <span class="num">${count}</span></button>`;
}

function viewToggle(filters: Filters): string {
  const btn = (v: View, label: string, n: number) =>
    `<button class="chip${filters.view === v ? " chip--on" : ""}" data-view="${v}"
      aria-pressed="${filters.view === v}">${label} (${n})</button>`;
  return `<div class="row" role="group" aria-label="Browse by">
    ${btn("recipes", "Recipes", index.length)}${btn("beans", "Bags", beans.length)}</div>`;
}

// A recipe is one row of an index: its curve, its name, its four numbers in
// columns that line up down the page, and one action. The source stays on the
// row — every transcription names where it came from, wherever it is listed.
// What a reader does with a recipe (QR, copy, download) lives on its page.
// A source is often titled "<author> — <what>". Under that author's heading the
// name is said already, so the link reads as the part that tells rows apart;
// its title keeps the label whole.
const sourceText = (e: IndexEntry): string => {
  const label = e.attribution.source_label;
  if (!label.startsWith(e.author.name)) return label;
  const rest = label.slice(e.author.name.length);
  const cut = /^\s*[—–-]\s*/.exec(rest);
  return cut ? rest.slice(cut[0].length) || label : label;
};

const ROWS_HEAD = `<p class="rows-head wide" aria-hidden="true"><span></span><span>Recipe</span><span>Dose → water</span><span>Ratio</span><span>Temp</span><span>Time</span><span></span></p>`;

function row(e: IndexEntry): string {
  const cell = (label: string, value: string) =>
    `<span data-label="${label}">${esc(value)}</span>`;
  return `<li class="recipe-row" data-id="${esc(e.id)}">
    <div class="row-glyph">${recipeGlyph(e, SCALE)}</div>
    <div class="row-main">
      <h3><a href="/recipes/${esc(e.slug)}/">${esc(e.title)}</a></h3>
      <p class="attribution row-source">${esc(e.methodLabel)}${
        // The document is the shareable unit. Say when it holds more than this
        // row; its page offers the whole of it.
        e.siblings > 1 ? ` · 1 of ${e.siblings} in its document` : ""
      } · from
        <a class="row-link" href="${esc(e.attribution.source_url)}" rel="noopener" title="${esc(e.attribution.source_label)}">${esc(sourceText(e))}</a></p>
    </div>
    <p class="figures row-figs">${cell("Dose", `${e.coffee}${e.brew ? ` → ${e.brew}` : ""}`)}${cell("Ratio", e.ratio)}${cell("Temp", e.temp)}${cell("Time", e.totalTime)}</p>
    <a class="btn btn--ghost" href="/r/?d=${e.payload}">${e.stepCount ? "Brew" : "Open"}</a>
  </li>`;
}

// The corpus is transcribed author by author, and that is how a reader looks for
// a recipe: one section per author, in the order the catalog introduces them.
function grouped(entries: IndexEntry[]): string {
  const groups = new Map<string, IndexEntry[]>();
  for (const e of entries)
    groups.set(e.author.name, [...(groups.get(e.author.name) ?? []), e]);
  return [...groups]
    .map(
      ([author, es]) => `<section class="group">
        <h2>${esc(author)} <span class="num muted">${es.length}</span></h2>
        <ul class="rows">${es.map(row).join("")}</ul>
      </section>`,
    )
    .join("");
}

// What the two glyphs are, said once above the rows that use them, each shown
// by a real row's own.
const timedRow = index.find((e) => e.curve);
const weighedRow = index.find((e) => !e.curve && e.dose && e.brewAmount);
const LEGEND = `<p class="legend">
    ${timedRow ? `<span>${recipeGlyph(timedRow, SCALE)}a pour schedule, all to one scale</span>` : ""}
    ${weighedRow ? `<span>${recipeGlyph(weighedRow, SCALE)}a dose and its water, where no schedule is stated</span>` : ""}
    <span>Brew opens the timer; Open, the recipe.</span>
  </p>`;

/**
 * The filters a lens can actually show. An author with no bag, carried across
 * a lens switch or arriving in a URL, would otherwise filter the bags to
 * nothing with no chip lit to say why.
 */
export function settle(f: Filters): Filters {
  const known = (f.view === "beans" ? roasters : authors).some(
    ([slug]) => slug === f.author,
  );
  return known || f.author === null ? f : { ...f, author: null };
}

const CORRECTIONS = `Quoted text stays the roasters’ — structure and
  transcription are CC0. ${SHARED_CORRECTIONS}`;

/** Every corpus recipe as schema.org Recipe, for the shell's static head. */
export function recipesJsonLd(): unknown[] {
  // `url`: the share link is disallowed in robots.txt and `/r/` canonicalizes to
  // bare `/r/`, so naming it would declare an address we forbid crawling.
  return index.flatMap((e) => {
    const result = decodePayload(e.payload);
    return result.ok ? docJsonLd(result.document) : [];
  });
}

/** The page body for a given filter state. Pure — same filters, same string. */
export function recipesBody(given: Filters): string {
  const filters = settle(given);
  const isBeans = filters.view === "beans";
  const shownRecipes = filterEntries(index, filters);
  const shownBeans = filterBeans(beans, filters);
  const empty = (isBeans ? shownBeans : shownRecipes).length === 0;
  return `
    ${siteHeader("/recipes/")}
    ${viewToggle(filters)}
    ${
      isBeans
        ? `<h1>Bags</h1>
         <p class="muted intro">${BAGS_INTRO} ${CORRECTIONS}</p>`
        : `<h1>Famous recipes, as data</h1>
         <p class="muted intro">Unofficial transcriptions of publicly shared recipes — every row names and
         links its source. ${CORRECTIONS}</p>`
    }
    <input id="q" class="field" type="search"
      placeholder="${isBeans ? "Filter by bean, roaster, origin, or notes" : "Filter by title, author, or method"}"
      value="${esc(filters.q)}" aria-label="${isBeans ? "Filter beans" : "Filter recipes"}">
    <div class="row facet" role="group" aria-label="${isBeans ? "Roaster" : "Author"}">
      <span class="facet-label">${isBeans ? "Roaster" : "Author"}</span>${(isBeans
        ? roasters
        : authors
      )
        .map(([slug, a]) =>
          chip(
            "author",
            slug,
            a.name,
            filters.author === slug,
            isBeans
              ? filterBeans(beans, { ...filters, author: slug }).length
              : filterEntries(index, { ...filters, author: slug }).length,
          ),
        )
        .join("")}</div>
    ${isBeans ? "" : `<div class="row facet" role="group" aria-label="Method"><span class="facet-label">Method</span>${methods.map(([id, label]) => chip("method", id, label, filters.method === id, filterEntries(index, { ...filters, method: id }).length)).join("")}</div>`}
    <div class="list-head">
      <p class="muted count" role="status">${
        isBeans
          ? `${shownBeans.length} of ${beans.length} bags`
          : `${shownRecipes.length} of ${index.length} recipes`
      }</p>
      ${isBeans ? "" : LEGEND}
    </div>
    ${
      empty
        ? `<div class="empty"><p>No ${isBeans ? "bags" : "recipes"} match.</p>
         <button class="btn btn--ghost" id="clear">Clear filters</button></div>`
        : isBeans
          ? bagSections(shownBeans)
          : `${overlayFigure(shownRecipes, SCALE.domain)}${ROWS_HEAD}${grouped(shownRecipes)}`
    }
    ${siteFooter(LICENSE_SITE, PACKAGES, QUOTED_PROSE)}
  `;
}
