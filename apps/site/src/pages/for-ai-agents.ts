import { EXAMPLES, PITFALLS, SYSTEM_PROMPT } from "../lib/agent-examples";
import {
  CRAWLERS_UNCHANGED,
  footerHtml,
  LICENSE_CORPUS,
} from "../lib/footer.mjs";
import { siteHeader } from "../lib/site-header.mjs";
import { esc } from "../lib/text.mjs";

const json = (v: unknown) => esc(JSON.stringify(v, null, 2));

/** The for-AI-agents body. Prerendered — see the note on `landingBody`. */
export const agentsBody = (): string => `
  ${siteHeader("/for-ai-agents/")}

  <h1>For AI agents</h1>
  <p>The short version of the spec, for a model asked to produce a coffee recipe as
  structured data. Every example below is validated against the published schema in
  CI, so it cannot drift.</p>

  <p class="muted">Prefer to read it all at once?
    <a href="/llms.txt">/llms.txt</a> is the link index and
    <a href="/llms-full.txt">/llms-full.txt</a> is every chapter concatenated.</p>

  <p class="muted">Working inside a coding agent?
    <a href="https://github.com/coffeejson-org/skills">coffeejson-org/skills</a>
    packages the format as three agent skills — changing it, adding it to a
    product, and turning a published source into a document —
    installable with <code>npx skills add coffeejson-org/skills</code>.</p>

  <h2>The loop that matters</h2>
  <ol>
    <li>Emit a document.</li>
    <li>Validate it against the <strong>authoring schema</strong>:
      <a href="/schema/authoring/1.0"><code>coffeejson-1.0.authoring.schema.json</code></a>.</li>
    <li>Fix what it rejects, and validate again.</li>
  </ol>
  <p>Use the authoring schema, not the runtime one. The runtime schema is
  deliberately permissive — a consumer must ignore members it does not recognize,
  which means a misspelled key silently disappears instead of failing. The
  authoring schema sets <code>additionalProperties: false</code>, so the same typo
  is a loud error while you can still fix it. The one exception is the reserved
  <code>ext</code> member, which it admits anywhere for your own vendor data. Humans can paste into the
  <a href="/validator/">validator</a>, which runs entirely in the browser.</p>

  <h2>System prompt</h2>
  <p>Drop this into the system prompt of a model you are asking for recipes:</p>
  <pre><code>${esc(SYSTEM_PROMPT)}</code></pre>

  <h2>Examples</h2>
  ${EXAMPLES.map(
    (e) => `
    <h3>${esc(e.prompt)}</h3>
    <p class="muted">${esc(e.note)}</p>
    <pre><code>${json(e.doc)}</code></pre>`,
  ).join("")}

  <h2>Mistakes models actually make</h2>
  <table class="pitfalls">
    <thead><tr><th>Wrong</th><th>Right</th><th>Why</th></tr></thead>
    <tbody>
      ${PITFALLS.map(
        (p) => `<tr>
        <td><code>${esc(p.wrong)}</code></td>
        <td><code>${esc(p.right)}</code></td>
        <td>${esc(p.why)}</td></tr>`,
      ).join("")}
    </tbody>
  </table>

  <h2>Two rules worth repeating</h2>
  <p><strong>Omit what you do not know.</strong> A document that says less is
  correct; a document that invents a water temperature is wrong, and it is wrong in
  a way no validator can catch. If the source did not state it, leave it out.</p>
  <p><strong>Unknown members are ignored, never rejected.</strong> That is what
  makes the format safe to extend, and it is why you should never write a consumer
  that fails on a key it does not recognize. See
  <a href="/docs/spec/07-versioning.md">Versioning &amp; conformance</a>.</p>

  <h2>License and crawling</h2>
  <p>The spec prose, the schema, the fixtures, the registries, and the recipe
  corpus’s structure and transcription are <strong>CC0</strong> — public domain. You may
  quote, reproduce, and build on them freely, with no attribution required and no
  conditions attached. Quoted roaster prose inside corpus documents remains the
  quoted source’s, carried as attributed quotation.</p>
  <p>Separately from the license, this website’s
  <a href="/robots.txt">robots.txt</a> asks bulk training crawlers not to fetch it,
  while welcoming search and retrieval. That is a request about <em>this server</em>,
  not a term of the license: a CC0 artifact carries no usage restriction, and
  nothing here adds one.</p>

  ${footerHtml(LICENSE_CORPUS, CRAWLERS_UNCHANGED)}`;
