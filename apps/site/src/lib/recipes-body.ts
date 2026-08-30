import { MEDIA_TYPE, decodePayload } from "@coffeejson/core";
import rawBeans from "../generated/beans-index.json";
import rawDocuments from "../generated/documents-index.json";
import rawIndex from "../generated/recipes-index.json";
import { filterBeans, filterEntries } from "./filter";
import type { BeanEntry, Filters, IndexEntry, View } from "./filter";
import { esc, slugify } from "./text.mjs";
import { siteHeader } from "./site-header.mjs";
import { docJsonLd } from "./jsonld";

// The recipe directory's markup, as a value. The build writes the unfiltered
// view into the shell and the page module attaches behaviour to it, so this
// file must stay reachable from Node: no `location`, no `document`, no state of
// its own. Everything that reads the URL or touches the DOM is in
// `pages/recipes.ts`, which is the only reason the two are separate files.

export const index = rawIndex as IndexEntry[];
// Two lenses over ONE corpus: the bean index is derived at build time from the
// beans these same documents already carry. No bean card invents a document.
const beans = rawBeans as BeanEntry[];
// The publications a card does not already carry whole: only these need a
// "Get all N", because for the rest the card IS the document.
const documents = rawDocuments as Record<string, string>;

const shareUrl = (slug: string): string => {
  const e = index.find((x) => x.slug === slug);
  return e ? `/r/?d=${e.payload}` : "/recipes/";
};

/**
 * Whatever the share controls are pointed at — a recipe by slug or a bag by key.
 * Both card kinds carry a real committed payload, so one set of handlers serves
 * both; the two id spaces cannot collide because a bean key always contains "/".
 */
interface Shareable { payload: string; file: string; title: string; qrPath: string }
export const shareable = (id: string): Shareable | null => {
  const r = index.find((x) => x.id === id);
  // A recipe's QR encodes the host-resolved `?s=` form, because enriched documents
  // outgrow level-M capacity at `?d=`; a bean document is small enough for `?d=`.
  // `&i=N` makes the code recipe-precise, so a French-press square on a
  // multi-method bag hands over one recipe, not three.
  if (r) {
    const siblings = index.filter((x) => x.slug === r.slug);
    const n = siblings.indexOf(r) + 1;
    const scoped = siblings.length > 1 ? `&i=${n}` : "";
    return { payload: r.payload, file: `${r.slug}.json`, title: r.title,
      qrPath: `/r/?s=${encodeURIComponent(r.slug)}${scoped}` };
  }
  const b = beans.find((x) => x.key === id);
  if (!b) return null;
  return { payload: b.payload, file: `${b.key.replace(/\//g, "-")}.json`, title: b.name,
    qrPath: `/r/?d=${b.payload}` };
};

function actionRow(id: string, openLabel: string): string {
  // THIS card's document, not the publication it came from: when the publication
  // holds more, say so and keep it one click away rather than silently handing it
  // over. The reader asked for a recipe.
  const entry = index.find((x) => x.id === id);
  const siblings = entry ? index.filter((x) => x.slug === entry.slug).length : 1;
  const whole = entry && siblings > 1 ? documents[entry.slug] : undefined;
  return `<div class="row">
      <a class="btn" href="/r/?d=${shareable(id)!.payload}">${openLabel}</a>
      <button class="btn btn--ghost" data-qr="${esc(id)}" aria-expanded="false"
              aria-controls="qr-${esc(id)}">QR</button>
      <button class="btn btn--ghost" data-copy="${esc(id)}">Copy link</button>
      <button class="btn btn--ghost" data-dl="${esc(id)}">Download</button>
      ${whole ? `<a class="btn btn--ghost" href="/r/?d=${whole}">Get all ${siblings}</a>` : ""}
    </div>
    <div id="qr-${esc(id)}" data-qr-slot="${esc(id)}"></div>`;
}

const authors = [...new Map(index.map((e) => [slugify(e.author.name), e.author])).entries()];
const methods = [...new Map(index.map((e) => [e.method, e.methodLabel])).entries()];
// The bean view's chips are roasters, but they ride the same `author` filter key
// and the same slug space — which is what lets a chip survive a view switch.
const roasters = [...new Map(beans.map((b) => [slugify(b.roaster.name), b.roaster])).entries()];

function chip(kind: "author" | "method", value: string, label: string, on: boolean): string {
  return `<button class="chip${on ? " chip--on" : ""}" data-kind="${kind}" data-value="${esc(value)}"
    aria-pressed="${on}">${esc(label)}</button>`;
}

function viewToggle(filters: Filters): string {
  const btn = (v: View, label: string, n: number) =>
    `<button class="chip${filters.view === v ? " chip--on" : ""}" data-view="${v}"
      aria-pressed="${filters.view === v}">${label} (${n})</button>`;
  return `<div class="row" role="group" aria-label="Browse by">
    ${btn("recipes", "Recipes", index.length)}${btn("beans", "Beans", beans.length)}</div>`;
}

/**
 * A bag, with the same share row a recipe card carries. What it shares is a real
 * document: the winning bean re-enveloped verbatim (see `buildBeansIndex`). The
 * links out are the roaster's own page and the corpus recipes brewed with it.
 */
function beanCard(b: BeanEntry): string {
  const href = b.url ?? b.roaster.url;
  const roaster = href
    ? `<a href="${esc(href)}" rel="noopener">${esc(b.roaster.name)}</a>`
    : esc(b.roaster.name);
  // Origin takes its own line: it already spends " · " inside a blend component,
  // so folding process and roast in makes a component's own process
  // indistinguishable from the bag's.
  const roastLine = [b.process, b.roast].filter(Boolean).join(" · ");
  return `<li class="card bean-card">
    <h3>${esc(b.name)}</h3>
    <p class="muted">From ${roaster}</p>
    ${b.origin ? `<p>${esc(b.origin)}</p>` : ""}
    ${roastLine ? `<p>${esc(roastLine)}</p>` : ""}
    ${b.notes ? `<p class="muted"><em>${esc(b.notes)}</em></p>` : ""}
    ${b.recipes.length
      ? `<p class="attribution">Brewed in ${b.recipes.length === 1 ? "this recipe" : "these recipes"}:</p>
         <ul class="bean-recipes">${b.recipes.map((r) =>
           `<li><a href="${shareUrl(r.slug)}">${esc(r.title)}</a> <span class="muted">· ${esc(r.methodLabel)}</span></li>`).join("")}</ul>`
      : `<p class="attribution">No corpus recipe uses this bag yet.</p>`}
    ${actionRow(b.key, "Open")}
  </li>`;
}

function card(e: IndexEntry): string {
  const facts = [
    `${e.coffee}${e.brew ? ` → ${e.brew}` : ""}`,
    e.ratio, e.temp, e.totalTime ? `${e.totalTime} total` : "",
  ].filter(Boolean).join(" · ");
  return `<li class="card">
    <h3><a href="/recipes/${esc(e.slug)}/">${esc(e.title)}</a></h3>
    <p class="muted">${esc(e.author.name)} · ${esc(e.methodLabel)}</p>
    <p>${esc(facts)}</p>
    <p class="attribution">Transcribed from
      <a href="${esc(e.attribution.source_url)}" rel="noopener">${esc(e.attribution.source_label)}</a>${
      // The document is the shareable unit, so Copy link / Download / QR hand over
      // all its recipes. Say so: giving someone three when they asked for one is
      // the same species of lie as showing one when there are three.
      e.siblings > 1 ? ` · one of ${e.siblings} recipes in this document` : ""}</p>
    ${actionRow(e.id, e.stepCount ? "Open / Brew" : "Open")}
  </li>`;
}

const CORRECTIONS = `Quoted text stays the roasters’ — structure and
  transcription are CC0. Spot an error, or want your material corrected or
  removed? <a href="https://github.com/coffeejson-org/coffeejson/issues"
  rel="noopener">Open an issue or a PR</a> — both are honored.`;

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
export function recipesBody(filters: Filters): string {
  const isBeans = filters.view === "beans";
  const shownRecipes = filterEntries(index, filters);
  const shownBeans = filterBeans(beans, filters);
  const empty = (isBeans ? shownBeans : shownRecipes).length === 0;
  return `
    ${siteHeader("/recipes/")}
    ${isBeans
      ? `<h1>Real bags, as data</h1>
         <p class="muted">Bean identities from the same transcribed documents — every card names and
         links its roaster. Where several documents describe the same bag, one card shows the
         fullest transcription and lists them all. ${CORRECTIONS}</p>`
      : `<h1>Famous recipes, as data</h1>
         <p class="muted">Unofficial transcriptions of publicly shared recipes — every card names and
         links its source. ${CORRECTIONS}</p>`}
    ${viewToggle(filters)}
    <input id="q" class="field" type="search"
      placeholder="${isBeans ? "Filter by bean, roaster, origin, or notes" : "Filter by title, author, or method"}"
      value="${esc(filters.q)}" aria-label="${isBeans ? "Filter beans" : "Filter recipes"}">
    <div class="row">${(isBeans ? roasters : authors)
      .map(([slug, a]) => chip("author", slug, a.name, filters.author === slug)).join("")}</div>
    ${isBeans ? "" : `<div class="row">${methods.map(([id, label]) => chip("method", id, label, filters.method === id)).join("")}</div>`}
    ${empty
      ? `<div class="banner">No ${isBeans ? "beans" : "recipes"} match.
         <button class="btn btn--ghost" id="clear">Clear filters</button></div>`
      : `<ul class="cards">${isBeans ? shownBeans.map(beanCard).join("") : shownRecipes.map(card).join("")}</ul>`}
  `;
}
