// "Implementations", not "Built with CoffeeJSON": one question, how do you
// implement this. Where the format is used is `/showcase`. A page headed "built
// with" listing one app reads as a claim.

import conformance from "../generated/conformance.json";
import { LICENSE_SITE, PACKAGES, siteFooter } from "../lib/footer.mjs";
import { siteHeader } from "../lib/site-header.mjs";
import { esc } from "../lib/text.mjs";

// The site serves the docs only as raw Markdown at their exact paths, so a page
// links the rendered copy on GitHub, the way the landing and showcase pages do.
const REPO = "https://github.com/coffeejson-org/coffeejson";
const GUIDE = `${REPO}/blob/main/docs/integration-guide.md`;

const FIXTURES = `${REPO}/blob/main/fixtures`;

// The conformance corpus, one cell per case and each a link to it: what an
// implementation must accept beside what it must refuse. Drawn from the
// fixtures on disk at build time, so the picture is the corpus.
const cells = (
  names: string[],
  accepts: boolean,
  href: (name: string) => string,
): string =>
  names
    .map(
      // Out of the tab order: a hundred and forty stops between two paragraphs
      // is a wall. The prose above links both corpora for a keyboard reader.
      (n) =>
        `<li><a class="cell ${accepts ? "accept" : "refuse"}" tabindex="-1" href="${href(n)}" rel="noopener" title="${esc(n)}"><span class="visually-hidden">${esc(n)}</span></a></li>`,
    )
    .join("");

// Two rows per corpus, each named for what an implementation must do with it.
// One run of filled and hollow cells read as "passed" and "not yet".
const tally = (
  label: string,
  accept: string[],
  refuse: string[],
  href: (name: string, accepts: boolean) => string,
): string => `
  <div class="tally">
    <h3>${label}</h3>
    <dl>
      <div><dt>Must accept <span class="num">${accept.length}</span></dt>
        <dd><ul class="cells">${cells(accept, true, (n) => href(n, true))}</ul></dd></div>
      <div><dt>Must refuse <span class="num">${refuse.length}</span></dt>
        <dd><ul class="cells">${cells(refuse, false, (n) => href(n, false))}</ul></dd></div>
    </dl>
    <p class="muted cell-caption" data-cell-caption>Every cell is one case in the repository, and a link to it.</p>
  </div>`;

const scan = conformance.scan;
const conformanceFigure = (): string => `
  <figure class="conformance">
    ${tally(
      "Documents",
      conformance.valid,
      conformance.invalid,
      (n, ok) => `${FIXTURES}/${ok ? "valid" : "invalid"}/${n}.json`,
    )}
    ${tally(
      "Scan vectors",
      scan.filter((v) => v.accepts).map((v) => v.name),
      scan.filter((v) => !v.accepts).map((v) => v.name),
      () => `${FIXTURES}/transport/scan-vectors.json`,
    )}
    <figcaption class="visually-hidden">The conformance corpus: document fixtures and scan vectors, each to accept or to refuse.</figcaption>
  </figure>`;

/** The implementations body. Prerendered — see the note on `landingBody`. */
export const implementationsBody = (): string => `
  ${siteHeader("/implementations/")}

  <h1>How to implement CoffeeJSON</h1>
  <p>Two functions: JSON in, your recipe type out, and back again. Required: a
  title, a dose, and either the water or the ratio. A reader ignores the rest.</p>
  <p>The <a href="${GUIDE}">integration guide</a> is the
  checklist. This page is what you lean on while you work it.</p>

  <h2>Reference SDKs</h2>
  <table class="impl">
    <thead><tr><th scope="col">Package</th><th scope="col">Language</th><th scope="col">What it covers</th></tr></thead>
    <tbody>
      <tr>
        <th scope="row" data-label="Package"><a href="https://www.npmjs.com/package/@coffeejson/core" rel="noopener"><code>@coffeejson/core</code></a></th>
        <td data-label="Language">TypeScript</td>
        <td data-label="What it covers">Wire types, the share-link codec, and a total <code>normalize()</code> — an untrusted payload cannot crash a renderer.</td>
      </tr>
      <tr>
        <th scope="row" data-label="Package"><a href="https://www.npmjs.com/package/@coffeejson/react" rel="noopener"><code>@coffeejson/react</code></a></th>
        <td data-label="Language">TypeScript</td>
        <td data-label="What it covers">Renders a document. Frozen class names, replaceable leaves, no styling you cannot override.</td>
      </tr>
      <tr>
        <th scope="row" data-label="Package"><a href="${REPO}-swift" rel="noopener"><code>coffeejson-swift</code></a></th>
        <td data-label="Language">Swift</td>
        <td data-label="What it covers">Wire types, codec and share-link transport for Apple platforms. Pure Foundation, no dependencies.</td>
      </tr>
    </tbody>
  </table>

  <pre><code>npm install @coffeejson/core</code></pre>

  <h2>Conformance is something you can run</h2>
  <p>The transport ships as
  <a href="https://github.com/coffeejson-org/coffeejson/blob/main/fixtures/transport/scan-vectors.json" rel="noopener">scan vectors</a>
  — each a URL exactly as a scanner hands it over, with the document it must
  yield or the reason to refuse it.</p>
  <p>The SDKs run them; so can yours. Rejection names come from the corpus, so
  two implementations describe the same failure the same way. Document shapes
  get the same treatment: a
  <a href="https://github.com/coffeejson-org/coffeejson/tree/main/fixtures" rel="noopener">fixture corpus</a>,
  each invalid document naming the rule it breaks.</p>

  ${conformanceFigure()}

  <h2>When you have shipped it</h2>
  <p>An implementation is anything that reads or writes CoffeeJSON — an app, a
  service, a library, a machine. The two roles are independent.</p>
  <p>Open a pull request adding yours to
  <a href="/registries/implementations.json"><code>registries/implementations.json</code></a>
  and it appears on <a href="/showcase/">the showcase</a>. No approval step,
  nothing to sign.</p>

  ${siteFooter(LICENSE_SITE, PACKAGES)}`;
