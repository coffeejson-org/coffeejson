import {
  encodePayload,
  fmtClock,
  fmtMeasurement,
  normalize,
} from "@coffeejson/core";
import QRCode from "qrcode";
import counts from "../generated/corpus-counts.json";
import hero from "../generated/hero-document.json";
import rawIndex from "../generated/recipes-index.json";
import { FAQ } from "../lib/faq.mjs";
import type { IndexEntry } from "../lib/filter";
import {
  LICENSE_SITE,
  PACKAGES,
  QUOTED_PROSE,
  SPEC_URL,
  siteFooter,
} from "../lib/footer.mjs";
import { jsonLines } from "../lib/json-lines";
import {
  corpusScale,
  curveFigure,
  pourSeries,
  sparklineSvg,
} from "../lib/pour-curve.mjs";
import { SAMPLE_DOC, SAMPLE_TEXT } from "../lib/sample";
import { siteHeader } from "../lib/site-header.mjs";
import { esc } from "../lib/text.mjs";

// Every figure in the facts strip is derived by `tools/gen.mjs`, because a
// hand-typed "65 recipes" goes stale the next time the corpus grows. It imports the
// COUNTS file, not the indexes, because vite modulepreloads whatever a page imports.

const samplePayload = encodePayload(SAMPLE_DOC);
const tryUrl = `/r/?d=${samplePayload}`;

const GUIDE =
  "https://github.com/coffeejson-org/coffeejson/blob/main/docs/integration-guide.md";

/** How much faster than the recipe the landing page plays it. */
export const PLAYBACK_SPEED = 15;

// The hero plays a corpus document from its own bytes. Nothing in it is typed
// here: the curve, the clock and the totals are all read out of `hero.text`.
function heroSeries() {
  const recipe = normalize(JSON.parse(hero.text)).recipes[0]!;
  const series = pourSeries(recipe);
  if (!series) throw new Error(`${hero.slug} has no pour schedule to play`);
  return series;
}

function liveDocument(): string {
  const series = heroSeries();
  const last = series.points[series.points.length - 1]!;
  return `
  <div class="live" data-live data-speed="${PLAYBACK_SPEED}" data-payload="${hero.payload}">
    <div class="live-stage">
      <dl class="readout">
        <div><dt>elapsed</dt><dd data-live-clock>${fmtClock(series.end)}</dd></div>
        <div><dt>water in</dt><dd data-live-water>${unitTail(esc(fmtMeasurement({ value: last[1], unit: series.unit })))}</dd></div>
      </dl>
      ${curveFigure(series)}
      <div class="live-controls" data-live-controls hidden>
        <button type="button" class="btn btn--ghost" data-live-toggle>Play</button>
        <input type="range" data-live-scrub min="0" max="${series.end}" step="1"
          value="${series.end}" aria-label="Recipe time">
        <span class="muted num">${PLAYBACK_SPEED}×</span>
      </div>
      <p class="live-hint muted"><span>Drag a pour: its line of the file changes with it.</span>
      <button type="button" class="link" data-live-reset hidden>Reset</button></p>
    </div>
    <div class="live-doc">
      <p class="live-file"><a class="live-file-link" href="/recipes/${esc(hero.slug)}/">${esc(hero.slug)}.json</a>
      <span><span data-live-state>the whole file · </span><a data-live-open href="/r/?d=${hero.payload}">brew it at real speed</a></span></p>
      <pre class="live-json" tabindex="0" aria-label="${esc(hero.slug)}.json"><code>${jsonLines(hero.text)}</code></pre>
    </div>
  </div>`;
}

// The sample document's own share link as a QR, drawn here at build time: this
// module never reaches a browser, so the encoder does not either. Inline SVG in
// `currentColor`, so the code is ink on the page's own ground.
function qrSvg(text: string, label: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
  return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
}

/** A measurement with its unit in a span, so the unit can be set smaller. */
const unitTail = (text: string): string => {
  const cut = text.lastIndexOf(" ");
  return cut < 0
    ? text
    : `${text.slice(0, cut)}<span class="unit">${text.slice(cut + 1)}</span>`;
};

// Every pour schedule in the corpus as its own curve, each a link to its
// page. Only recipes that state one: a wall half made of identical ratio bars
// said less than the count beside it. The index is imported here and nowhere
// the browser loads — this module runs at build time only.
const timed = (rawIndex as IndexEntry[]).filter((e) => e.curve);
// All drawn in one box — the longest brew wide, the largest tall — so the wall
// can be read across: a short brew is a short curve.
const { domain } = corpusScale(rawIndex as IndexEntry[]);
// A row's own author is the group it would sit in on the directory; on the
// wall it is the part of the title a reader already knows.
const short = (e: IndexEntry): string =>
  e.title.startsWith(`${e.author.name} `) ||
  e.title.startsWith(`${e.author.name} — `)
    ? e.title.slice(e.author.name.length).replace(/^[\s—–-]+/, "")
    : e.title;
const wall = (): string =>
  timed
    .map((e, k) => {
      const nth =
        (rawIndex as IndexEntry[]).filter((x) => x.slug === e.slug).indexOf(e) +
        1;
      const href = `/recipes/${esc(e.slug)}/${e.siblings > 1 ? `#recipe-${nth}` : ""}`;
      return `<li style="--k:${k}"><a class="wall-link" href="${href}" title="${esc(e.title)}">${sparklineSvg(e.curve!, domain)}<span>${esc(short(e))}</span></a></li>`;
    })
    .join("");

/**
 * The landing page body. It is a document, so it is filled at build time by
 * `tools/prerender.ts` rather than assembled in the browser, and a reader that
 * runs no JavaScript gets the page — the live document included, at its last
 * frame. The one module the shell loads only plays it.
 */
export const landingBody = (): string => `
  ${siteHeader("/")}

  <section class="hero">
    <h1 class="display">A coffee recipe that opens anywhere</h1>
    <div class="hero-pitch">
      <p class="lede">Write it in one app, open it in the next. Print it on a bag, paste it in a
      message, keep it as a file. Dose, water, temperature and every timed pour arrive as
      numbers — in the reader’s own units and language.</p>
      <div class="row">
        <a class="btn btn--lg" href="/recipes/">Browse the recipes</a>
        <a class="btn btn--ghost btn--lg" href="${GUIDE}" rel="noopener">Make your app read it</a>
      </div>
    </div>
    ${liveDocument()}
  </section>

  <section class="mv">
    <div class="mv-head">
      <h2>A recipe that travels</h2>
      <div>
        <p>A recipe here is a file, not a picture of one. It rides inside a link, prints as a
        QR code on a bag, and exports out of one app into the next — with the dose, the water,
        the temperature and every timed pour still readable as numbers.</p>
        <p>So a roaster can put the brew guide on the bag. A creator can publish a routine a
        timer follows, instead of a viewer pausing the video to write it down. And a library
        outlives whichever app made it — including this one.</p>
      </div>
    </div>
    <ul class="carriers wide">
      <li>
        <h3>As a file</h3>
        <pre><code>${SAMPLE_TEXT.replace(/</g, "&lt;")}</code></pre>
        <p class="muted">Everything past the three required fields is whatever you happen to
        know — this one states its water both ways, as a weight and as a ratio.</p>
        <div class="row"><a class="btn" href="${tryUrl}">Open it in the viewer</a>
          <a class="btn btn--ghost" href="/validator/">Validate your own</a></div>
      </li>
      <li>
        <h3>In a link</h3>
        <a class="share-url" href="${tryUrl}"><b>coffeejson.org/r/?d=</b>${samplePayload}</a>
        <p class="muted">The same document as an address. Nothing is stored and nothing is
        looked up.</p>
      </li>
      <li class="carrier--qr">
        <h3>On a bag</h3>
        <figure class="qr-figure">${qrSvg(`https://coffeejson.org${tryUrl}`, "QR code — scan to open the document beside it")}</figure>
        <p class="muted">The same document again, as a code to print. A whole recipe fits
        too: <a href="/demo/tetsu-kasuya-4-6.svg">Tetsu Kasuya’s 4:6</a>, every timed pour,
        inside one square.</p>
      </li>
    </ul>
  </section>

  <section class="mv mv--ships">
    <div class="mv-head">
      <h2>It already ships</h2>
      <dl class="facts">
        <div><dt>${counts.recipes}</dt><dd><a href="/recipes/">recipes</a>, each attributed to its source</dd></div>
        <div><dt>${counts.beans}</dt><dd><a href="/beans/">bags</a>, from
          ${counts.roasters} roasters</dd></div>
        <div><dt>3</dt><dd><a href="/implementations/">packages</a> — TypeScript, React,
          Swift</dd></div>
        <div><dt>1</dt><dd><a href="/showcase/">app</a> on the App Store</dd></div>
      </dl>
    </div>
    <ul class="wall wide" data-draw>${wall()}</ul>
    <p class="muted">Every pour schedule in the corpus, each drawn from its own steps and
    all to one scale — the longest brew is the full width, the largest the full height.
    ${timed.length} of the ${counts.recipes} recipes state one. One implementer so far, and
    more are wanted — <a href="https://github.com/coffeejson-org/coffeejson/issues" rel="noopener">tell
    us what you are building</a>, or where the format is wrong.</p>
    <p class="status"><strong>Early.</strong> CoffeeJSON 1.1 is settled in shape and still being polished —
    <a href="https://github.com/coffeejson-org/coffeejson/issues" rel="noopener">tell us
    where the model is wrong</a>.</p>
  </section>

  <div class="mv mv-split">
    <section>
      <h2>What it takes</h2>
      <p>Two functions: JSON in, your recipe type out, and back again. Required: a title, a
      dose, and either the water or the ratio. A reader ignores the rest — and is required
      to, so what you write this month still reads next year.</p>
      <p>Mapped field by field against Visualizer’s and BeanConqueror’s public models: on the
      bean side, one field in sixteen had no home. Either could read it tomorrow. No account,
      no endpoint, no SDK you have to take.</p>
      <div class="row"><a class="btn" href="${GUIDE}" rel="noopener">Read the integration guide</a></div>
      <h3>What it doesn’t do</h3>
      <p>Dose, water, temperature and timing travel exactly; grind and espresso dialing still
      need your gear. There’s no cup-score field yet — a score without its scale is worse
      than no score.</p>
    </section>
    <section>
      <h2>Why it’s safe to build on</h2>
      <p>The shape of the format is answering bugs that already happened, in public trackers:
      a value read in the wrong unit, a category compared as a display string, corruption
      nothing validated for months. Hence canonical units, machine ids, and a schema to fail
      against.</p>
      <ul class="guarantees">
        <li><strong>Forward-compatible reads</strong> — valid today, valid as the format grows.</li>
        <li><strong>Locale-neutral ids</strong> — every app renders its own language.</li>
        <li><strong>CC0</strong> spec, schema and corpus; <strong>Apache-2.0</strong>
          packages, patent grant included.</li>
        <li><strong>Nothing to join.</strong> Disagree and you fork it — that’s the guarantee.</li>
      </ul>
    </section>
  </div>

  <section class="mv">
    <h2>Questions</h2>
    <ul class="qa wide">
      ${FAQ.map(({ q, a }) => `<li><h3>${esc(q)}</h3><p>${esc(a)}</p></li>`).join("")}
    </ul>
  </section>

  <section class="mv">
    <h2>Read the spec</h2>
    <ul class="shelf wide">
      <li><a href="${GUIDE}" rel="noopener">Integration guide</a><span>The consumer and producer checklists</span></li>
      <li><a href="${SPEC_URL}" rel="noopener">Specification</a><span>Envelope, Recipe, Bean, Tasting, vocabularies</span></li>
      <li><a href="/schema/1.0">JSON Schema</a><span>Draft 2020-12</span></li>
      <li><a href="https://github.com/coffeejson-org/coffeejson/blob/main/docs/transport.md" rel="noopener">Transport</a><span>File, share URL, QR</span></li>
      <li><a href="https://github.com/coffeejson-org/coffeejson/tree/main/fixtures" rel="noopener">Fixture corpus</a><span>Valid and invalid, checked in CI</span></li>
    </ul>
  </section>

  <section class="outro wide" data-draw>
    <div class="outro-curve" aria-hidden="true">${sparklineSvg(heroSeries())}</div>
    <p class="outro-line">Write it in one app, open it in the next.</p>
    <div class="row">
      <a class="btn btn--lg" href="/recipes/">Browse the recipes</a>
      <a class="btn btn--ghost btn--lg" href="${GUIDE}" rel="noopener">Make your app read it</a>
    </div>
  </section>

  ${siteFooter(LICENSE_SITE, PACKAGES, QUOTED_PROSE)}`;
