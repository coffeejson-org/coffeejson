// "Implementations", not "Built with CoffeeJSON": one question, how do you
// implement this. Where the format is used is `/showcase`. A page headed "built
// with" listing one app reads as a claim.

import { LICENSE_SITE, licenseLine, PACKAGES } from "../lib/footer.mjs";
import { siteHeader } from "../lib/site-header.mjs";

// The site serves the docs only as raw Markdown at their exact paths, so a page
// links the rendered copy on GitHub, the way the landing and showcase pages do.
const REPO = "https://github.com/coffeejson-org/coffeejson";
const GUIDE = `${REPO}/blob/main/docs/integration-guide.md`;
const SPEC = `${REPO}/blob/main/docs/README.md`;

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
        <th scope="row"><code>@coffeejson/core</code></th>
        <td>TypeScript</td>
        <td>Wire types, the share-link codec, and a total <code>normalize()</code> — an untrusted payload cannot crash a renderer.</td>
      </tr>
      <tr>
        <th scope="row"><code>@coffeejson/react</code></th>
        <td>TypeScript</td>
        <td>Renders a document. Frozen class names, replaceable leaves, no styling you cannot override.</td>
      </tr>
      <tr>
        <th scope="row"><code>coffeejson-swift</code></th>
        <td>Swift</td>
        <td>Wire types, codec and share-link transport for Apple platforms. Pure Foundation, no dependencies.</td>
      </tr>
    </tbody>
  </table>

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

  <h2>When you have shipped it</h2>
  <p>An implementation is anything that reads or writes CoffeeJSON — an app, a
  service, a library, a machine. The two roles are independent.</p>
  <p>Open a pull request adding yours to
  <a href="/registries/implementations.json"><code>registries/implementations.json</code></a>
  and it appears on <a href="/showcase/">the showcase</a>. No approval step,
  nothing to sign.</p>

  <footer class="site-footer">
    <a href="/">Home</a> · <a href="/showcase/">Showcase</a> ·
    <a href="${SPEC}">Spec</a> · <a href="/agents/">For AI agents</a> ·
    <a href="https://github.com/coffeejson-org/coffeejson" rel="noopener">GitHub</a>
    ${licenseLine(LICENSE_SITE, PACKAGES)}
  </footer>`;
