import { encodePayload } from "@coffeejson/core";
import { SAMPLE_DOC, SAMPLE_TEXT } from "../lib/sample";
import counts from "../generated/corpus-counts.json";
import { LICENSE_SITE, PACKAGES, QUOTED_PROSE, footerHtml } from "../lib/footer.mjs";
import { siteHeader } from "../lib/site-header.mjs";
import { FAQ } from "../lib/faq.mjs";
import { esc } from "../lib/text.mjs";

// Every figure in the facts strip is derived by `tools/gen.mjs`, because a
// hand-typed "65 recipes" goes stale the next time the corpus grows. It imports the
// COUNTS file, not the indexes, because vite modulepreloads whatever a page imports.

const tryUrl = `/r/?d=${encodePayload(SAMPLE_DOC)}`;

const GUIDE = "https://github.com/coffeejson-org/coffeejson/blob/main/docs/integration-guide.md";

/**
 * The landing page body. This page has no event listener and no state — it is a
 * document — so it is filled at build time by `tools/prerender.ts` rather than
 * assembled in the browser, and the shell loads no module for it. A reader that
 * runs no JavaScript gets the page.
 */
export const landingBody = (): string => `
  ${siteHeader("/")}

  <h1 class="display">A coffee recipe that opens anywhere</h1>
  <p class="lede">Write it in one app, open it in the next. Print it on a bag, paste it in a
  message, keep it as a file. Dose, water, temperature and every timed pour arrive as
  numbers — in the reader’s own units and language.</p>

  <div class="row">
    <a class="btn" href="/recipes/">Browse the recipes</a>
    <a class="btn btn--ghost" href="${GUIDE}" rel="noopener">Make your app read it</a>
  </div>

  <div class="banner"><strong>Early.</strong> CoffeeJSON 1.0 is settled in shape and still being polished —
  <a href="https://github.com/coffeejson-org/coffeejson/issues" rel="noopener">tell us
  where the model is wrong</a>.</div>

  <h2 class="pull">A recipe that travels</h2>
  <p>A recipe here is a file, not a picture of one. It rides inside a link, prints as a
  QR code on a bag, and exports out of one app into the next — with the dose, the water,
  the temperature and every timed pour still readable as numbers.</p>
  <p>So a roaster can put the brew guide on the bag. A creator can publish a routine a
  timer follows, instead of a viewer pausing the video to write it down. And a library
  outlives whichever app made it — including this one.</p>

  <h2>What a document looks like</h2>
  <div class="demo-pair">
    <div>
      <p class="muted">Everything past the three required fields is whatever you happen to
      know — this one states its water both ways, as a weight and as a ratio.</p>
      <pre><code>${SAMPLE_TEXT.replace(/</g, "&lt;")}</code></pre>
      <div class="row"><a class="btn" href="${tryUrl}">Open it in the viewer</a>
        <a class="btn btn--ghost" href="/validator/">Validate your own</a></div>
    </div>
    <figure class="card qr-figure">
      <img src="/demo/tetsu-kasuya-4-6.svg" alt="QR code — scan to open Tetsu Kasuya’s 4:6 recipe" width="256" height="256">
      <figcaption class="muted">A real one: Tetsu Kasuya’s 4:6, every timed pour, inside
      the square. Scan it and your phone brews along.</figcaption>
    </figure>
  </div>

  <h2 class="pull">It already ships</h2>
  <dl class="facts">
    <div><dt>${counts.recipes}</dt><dd><a href="/recipes/">recipes</a>, each attributed to its source</dd></div>
    <div><dt>${counts.beans}</dt><dd><a href="/beans/">bags</a>, from
      ${counts.roasters} roasters</dd></div>
    <div><dt>3</dt><dd><a href="/implementations/">packages</a> — TypeScript, React,
      Swift</dd></div>
    <div><dt>1</dt><dd><a href="/showcase/">app</a> on the App Store</dd></div>
  </dl>
  <p class="muted">One implementer so far, and more are wanted — <a
  href="https://github.com/coffeejson-org/coffeejson/issues" rel="noopener">tell us what
  you are building</a>, or where the format is wrong.</p>

  <h2>What it takes</h2>
  <p>Two functions: JSON in, your recipe type out, and back again. Required: a title, a
  dose, and either the water or the ratio. A reader ignores the rest — and is required
  to, so what you write this month still reads next year.</p>
  <p>Mapped field by field against Visualizer’s and BeanConqueror’s public models: on the
  bean side, one field in sixteen had no home. Either could read it tomorrow. No account,
  no endpoint, no SDK you have to take.</p>
  <div class="row"><a class="btn" href="${GUIDE}" rel="noopener">Read the integration guide</a></div>

  <h2 class="pull">Why it’s safe to build on</h2>
  <p>The shape of the format is answering bugs that already happened, in public trackers:
  a value read in the wrong unit, a category compared as a display string, corruption
  nothing validated for months. Hence canonical units, machine ids, and a schema to fail
  against.</p>
  <ul>
    <li><strong>Forward-compatible reads</strong> — valid today, valid as the format grows.</li>
    <li><strong>Locale-neutral ids</strong> — every app renders its own language.</li>
    <li><strong>CC0</strong> spec, schema and corpus; <strong>Apache-2.0</strong>
      packages, patent grant included.</li>
    <li><strong>Nothing to join.</strong> Disagree and you fork it — that’s the guarantee.</li>
  </ul>

  <h2>What it doesn’t do</h2>
  <p>Dose, water, temperature and timing travel exactly; grind and espresso dialing still
  need your gear. There’s no cup-score field yet — a score without its scale is worse
  than no score.</p>

  <h2 class="pull">Questions</h2>
  ${FAQ.map(({ q, a }) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}

  <h2>Read the spec</h2>
  <ul>
    <li><a href="${GUIDE}" rel="noopener">Integration guide</a> — the consumer and producer checklists</li>
    <li><a href="https://github.com/coffeejson-org/coffeejson/tree/main/docs/spec" rel="noopener">Specification</a> — envelope, Recipe, Bean, Tasting, vocabularies</li>
    <li><a href="/schema/1.0">JSON Schema</a> — draft 2020-12</li>
    <li><a href="https://github.com/coffeejson-org/coffeejson/blob/main/docs/transport.md" rel="noopener">Transport</a> — file, share URL, QR</li>
    <li><a href="https://github.com/coffeejson-org/coffeejson/tree/main/fixtures" rel="noopener">Fixture corpus</a> — valid and invalid, checked in CI</li>
  </ul>

  ${footerHtml(LICENSE_SITE, PACKAGES, QUOTED_PROSE)}`;
