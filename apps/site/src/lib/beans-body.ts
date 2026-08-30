import beans from "../generated/beans-index.json";
import { LICENSE_SITE, QUOTED_PROSE, licenseLine } from "./footer.mjs";
import { esc, slugify } from "./text.mjs";
import { siteHeader } from "./site-header.mjs";

// The roaster filter is VIEW STATE (`?roaster=onyx`), not an indexed path: a
// subset of an existing page is not a publication, the same call `/recipes/` makes
// for its chips. Reversing it is one `indexableUrls()` addition.

type Bean = (typeof beans)[number];

const roasters = [...new Map(beans.map((b) => [slugify(b.roaster.name), b.roaster.name])).entries()]
  .sort((a, b) => a[1].localeCompare(b[1]));

/**
 * The bags hub. Unlike the other prerendered pages this one has view state — the
 * roaster filter is `?roaster=<slug>` — so the build fills it with the unfiltered
 * list and the module below re-renders when a filter is present. A crawler gets
 * every bag; a filtered link still filters.
 */
export const beansBody = (selected: string | null = null): string => {
const shown: Bean[] = selected ? beans.filter((b) => slugify(b.roaster.name) === selected) : beans;

const chip = (slug: string | null, label: string) => {
  const href = slug === null ? "/beans/" : `/beans/?roaster=${encodeURIComponent(slug)}`;
  const on = slug === selected;
  return `<a class="chip${on ? " chip--on" : ""}" href="${href}"${on ? ' aria-current="true"' : ""}>${esc(label)}</a>`;
};

const card = (b: Bean) => {
  const facts = [b.origin, b.process, b.roast].filter(Boolean).join(" · ");
  return `
    <article class="card">
      <h2><a href="/beans/${esc(b.slug)}/">${esc(b.name)}</a></h2>
      <p class="muted">${esc(b.roaster.name)}</p>
      ${facts ? `<p>${esc(facts)}</p>` : ""}
      ${b.notes ? `<p class="muted"><em>${esc(b.notes)}</em></p>` : ""}
      ${b.recipes.length
        ? `<p class="muted">${b.recipes.length} transcribed brew${b.recipes.length === 1 ? "" : "s"}</p>`
        : ""}
    </article>`;
};

return `
  ${siteHeader("/beans/")}

  <h1>Bags</h1>
  <p>Every coffee in the corpus as an identity of its own — one page per bag,
  whether one published source describes it or three. Each names and links the
  source it was transcribed from; corrections welcome.</p>
  <p class="muted"><a href="/recipes/">Browse the recipes instead</a></p>

  <nav class="row chips" aria-label="Filter by roaster">
    ${chip(null, `All ${beans.length}`)}
    ${roasters.map(([slug, name]) => chip(slug, name)).join("")}
  </nav>

  <p class="muted" role="status">${shown.length} of ${beans.length} bags${
    selected ? ` from ${esc(roasters.find(([s]) => s === selected)?.[1] ?? selected)}` : ""}</p>

  ${shown.length ? shown.map(card).join("") : `<p>No bag matches that roaster.</p>`}

  <footer class="site-footer">
    <a href="/">Home</a> · <a href="/recipes/">Browse</a><a href="/showcase/">Showcase</a> ·
    <a href="/docs/">Spec</a> ·
    <a href="https://github.com/coffeejson-org/coffeejson" rel="noopener">GitHub</a>
    ${licenseLine(LICENSE_SITE, QUOTED_PROSE)}
  </footer>`;
}
