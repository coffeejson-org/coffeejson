import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePayload, normalize } from "@coffeejson/core";
import core from "../../../../packages/core/package.json";
import documents from "../generated/embed-documents.json";
import { elementAttributes } from "../lib/element-attributes";
import {
  documentTitle,
  EMBED_VIEWER,
  embedSnippet,
  jsonLdByDefault,
} from "../lib/embed-snippet";
import { LICENSE_SITE, PACKAGES, siteFooter } from "../lib/footer.mjs";
import { inlineQrSvg } from "../lib/qr";
import { siteHeader } from "../lib/site-header.mjs";
import { esc } from "../lib/text.mjs";

// This page demonstrates the element and says so. Every card is drawn by the
// script a host would paste, from the CDN, at the version the snippet names.
// Nothing here claims anyone else uses the element — /showcase says what has
// shipped — so no sentence on this page goes stale when someone does.

/** The element version the page loads and the snippet pins: core's own. */
export const ELEMENT_VERSION = core.version;

// A path string, not a URL object: under jsdom the global `URL` is not Node's,
// and `fs` refuses it.
const README = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/core/README.md",
);
const README_URL =
  "https://github.com/coffeejson-org/coffeejson/blob/main/packages/core/README.md#the-coffee-json-element";

/** The document the page opens on: a bag with its recipes. */
export const DEFAULT_SLUG = "verve-sermon";
/** The use cases' documents: a bag with its recipe, a recipe, and a short bag
 *  whose link still fits a QR. */
export const USE_CASE_SLUGS = {
  roaster: "cat-cloud-the-answer",
  blog: "james-hoffmann-ultimate-v60",
  stripped: "stumptown-hair-bender",
} as const;

const docOf = (slug: string): unknown => {
  const found = documents.find((d) => d.slug === slug);
  if (!found) throw new Error(`embed: no corpus document "${slug}"`);
  const decoded = decodePayload(found.payload);
  if (!decoded.ok) throw new Error(`embed: "${slug}" does not decode`);
  return decoded.document;
};
const payloadOf = (slug: string): string =>
  documents.find((d) => d.slug === slug)!.payload;

/** Who a document is filed under in the picker: the bag's roaster, else the
 *  recipe's author. */
const groupOf = (doc: unknown): string => {
  const { beans, recipes } = normalize(doc);
  return beans[0]?.roaster?.name ?? recipes[0]?.author?.name ?? "Other";
};

const pickerOptions = (): string => {
  const groups = new Map<string, { slug: string; label: string }[]>();
  for (const { slug } of documents) {
    const doc = docOf(slug);
    const group = groupOf(doc);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push({ slug, label: documentTitle(doc) });
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([group, items]) =>
        `<optgroup label="${esc(group)}">${items
          .map(
            (i) =>
              `<option value="${esc(i.slug)}"${i.slug === DEFAULT_SLUG ? " selected" : ""}>${esc(i.label)}</option>`,
          )
          .join("")}</optgroup>`,
    )
    .join("");
};

// The page's own cards link to the viewer on this site and set no `jsonld`: the
// corpus pages already carry each document's structured data.
const card = (slug: string, attrs = ""): string =>
  `<coffee-json d="${esc(payloadOf(slug))}" viewer="/r/"${attrs}><a href="/r/?d=${esc(payloadOf(slug))}">${esc(documentTitle(docOf(slug)))}, as CoffeeJSON</a></coffee-json>`;

const attributeTable = (): string => `
  <table class="impl">
    <thead><tr><th scope="col">Attribute</th><th scope="col">What it does</th></tr></thead>
    <tbody>${elementAttributes(readFileSync(README, "utf8"))
      .map(
        (r) =>
          `<tr><th scope="row" data-label="Attribute"><code>${esc(r.name)}</code></th><td data-label="What it does">${r.html}</td></tr>`,
      )
      .join("")}</tbody>
  </table>`;

const strippedLink = `${EMBED_VIEWER}?d=${payloadOf(USE_CASE_SLUGS.stripped)}`;

/** The embed page body. Prerendered — see the note on `landingBody`. */
export const embedBody = (): string => {
  const doc = docOf(DEFAULT_SLUG);
  const jsonld = jsonLdByDefault(doc);
  return `
  ${siteHeader("/embed/")}

  <h1>Put the recipe next to the coffee</h1>
  <p class="lede">Paste four lines into a product page or a blog post, and your
  readers get the dose, the water and every timed pour as a card they can brew
  from. No plugin, no account, nothing to host.</p>

  <section class="embed-try" aria-label="Try it">
    <div class="embed-live" data-embed-live>${card(DEFAULT_SLUG, ' id="embed-card"')}</div>
    <div class="embed-code">
      <ol class="embed-steps">
        <li>Pick a coffee, or <a href="/generate/">build your own</a>.</li>
        <li>Copy the four lines.</li>
        <li>Paste them anywhere your site takes HTML: a theme's custom-code
        section, a page builder's HTML block, a post's source view.</li>
      </ol>
      <label for="embed-pick">Coffee</label>
      <select class="field" id="embed-pick" data-embed-pick>${pickerOptions()}</select>
      <p class="embed-error" data-embed-error hidden></p>
      <label class="embed-check"><input type="checkbox" data-embed-jsonld${jsonld ? " checked" : ""}>
      <span>Add schema.org data to the page's <code>&lt;head&gt;</code></span></label>
      <p class="muted">For a recipe on its own, this gives search engines the
      steps. Leave it off for a bag on a shop page whose theme already describes
      the product.</p>
      <pre data-embed-version="${esc(ELEMENT_VERSION)}"><code data-embed-snippet>${esc(embedSnippet(doc, { version: ELEMENT_VERSION, jsonld }))}</code></pre>
    </div>
  </section>

  <h2 class="pull">Where it earns its place</h2>
  <ul class="ledger">
    <li>
      <h3>A roaster's product page</h3>
      <div>
        <p>Sell the bag with the way you brew it. A shopper sees your dose,
        ratio and pours before they buy, and the first cup at home tastes the
        way you meant it to, not the way they guessed.</p>
        ${card(USE_CASE_SLUGS.roaster)}
      </div>
    </li>
    <li>
      <h3>A blog post or a brew guide</h3>
      <div>
        <p>Give readers a recipe they can follow, not retype. Open shows it
        full size, with a timer that walks through each pour when the recipe
        has timed pours. Download hands them the file, for any app that reads
        CoffeeJSON.</p>
        ${card(USE_CASE_SLUGS.blog)}
      </div>
    </li>
    <li>
      <h3>A shop that strips scripts</h3>
      <div>
        <p>Some store builders remove scripts, so the card never draws. The
        link inside it still opens the whole recipe, and the same link prints
        as a QR for the bag: <a href="/generate/">the generator</a> makes a
        sheet of them.</p>
        <p><a href="${esc(strippedLink)}">${esc(documentTitle(docOf(USE_CASE_SLUGS.stripped)))}, as CoffeeJSON</a></p>
        <figure class="qr-figure">${inlineQrSvg(strippedLink, "QR code for the same link")}</figure>
      </div>
    </li>
  </ul>

  <h2 class="pull">Why four lines are enough</h2>
  <ul class="ledger">
    <li>
      <h3>Nothing to keep running</h3>
      <p>The whole recipe rides inside the four lines on your page. Nothing is
      stored on a server, and there is no account to make or renew.</p>
    </li>
    <li>
      <h3>In your words and your colors</h3>
      <p>Name the buttons and captions in your page's language, show metric or
      imperial, and restyle the card with CSS. The attributes below say how.</p>
    </li>
    <li>
      <h3>Readable by search engines</h3>
      <p>Tick the box and the page carries the recipe as schema.org data, so a
      search engine reads the steps instead of guessing them from prose.</p>
    </li>
  </ul>

  <h2 class="pull">Attributes</h2>
  ${attributeTable()}
  <p>A page with script can set <code>labels</code> as an object on the
  element's property instead. The element fires <code>coffeejson-load</code>
  and <code>coffeejson-error</code>, and both bubble. Theme it with the
  <code>--cj-*</code> custom properties and <code>::part()</code>. The
  <a href="${README_URL}" rel="noopener">package README</a> has the rest.</p>

  <div class="row">
    <a class="btn btn--lg" href="/generate/">Make a card for your coffee</a>
    <a class="btn btn--ghost btn--lg" href="/recipes/">Browse the recipes</a>
  </div>

  <p class="muted">Every card on this page is drawn by the script the snippet
  loads, at version <code>${esc(ELEMENT_VERSION)}</code>, from the npm CDN. This
  site is demonstrating the element, not listing who uses it:
  <a href="/showcase/">the showcase</a> says what has shipped.</p>

  ${siteFooter(LICENSE_SITE, PACKAGES)}`;
};
