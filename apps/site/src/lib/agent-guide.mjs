import { EXAMPLES, PITFALLS, SYSTEM_PROMPT } from "./agent-examples.mjs";
import { esc } from "./text.mjs";

// The guide for a model asked to emit CoffeeJSON, written ONCE and rendered
// twice: as `/agents/` for a reader with a browser, and as `/agents.md` for an
// agent that fetches rather than renders. A `.mjs` with a `.d.mts` beside it,
// for the reason `footer.mjs` states — the page is TypeScript built by vite and
// the markdown is written by `tools/gen.mjs`, which is plain Node.
//
// The prose is data, not markup, because the alternative is two copies of it and
// the second one goes stale silently. The same argument `gen.mjs` makes about
// llms.txt. Sections carry blocks; blocks carry inline runs:
//
//   inline  "text" | {code} | {strong} | {em} | {text, href} | {text, href, code}
//   block   {p, muted?, htmlOnly?} | {ol} | {code} | {examples} | {pitfalls}
//
// A site-relative href renders relative in HTML and absolute in markdown: the
// markdown is read detached from the site, where `/validator/` resolves nowhere.
// `htmlOnly` is for page furniture — the markdown is wrapped by `gen.mjs` in an
// agent-instructions document that already routes to those places properly.

const SKILLS_REPO = "https://github.com/coffeejson-org/skills";

/** The body of both surfaces, in reading order. The `<h1>` belongs to neither. */
export const GUIDE = [
  {
    heading: null,
    blocks: [
      {
        p: [
          "The short version of the spec, for a model asked to produce a coffee recipe as structured data. Every example below is validated against the published schema in CI, so it cannot drift.",
        ],
      },
      {
        muted: true,
        htmlOnly: true,
        p: [
          "Prefer to read it all at once? ",
          { text: "/llms.txt", href: "/llms.txt" },
          " is the link index and ",
          { text: "/llms-full.txt", href: "/llms-full.txt" },
          " is every chapter concatenated.",
        ],
      },
      {
        muted: true,
        htmlOnly: true,
        p: [
          "Working inside a coding agent? ",
          { text: "coffeejson-org/skills", href: SKILLS_REPO },
          " packages the format as three agent skills — changing it, adding it to a product, and turning a published source into a document — installable with ",
          { code: "npx skills add coffeejson-org/skills" },
          ".",
        ],
      },
    ],
  },
  {
    heading: "The loop that matters",
    blocks: [
      {
        ol: [
          ["Emit a document."],
          [
            "Validate it against the ",
            { strong: "authoring schema" },
            ": ",
            {
              text: "coffeejson-1.0.authoring.schema.json",
              href: "/schema/authoring/1.0",
              code: true,
            },
            ".",
          ],
          ["Fix what it rejects, and validate again."],
        ],
      },
      {
        p: [
          "Use the authoring schema, not the runtime one. The runtime schema is deliberately permissive — a consumer must ignore members it does not recognize, which means a misspelled key silently disappears instead of failing. The authoring schema sets ",
          { code: "additionalProperties: false" },
          ", so the same typo is a loud error while you can still fix it. The one exception is the reserved ",
          { code: "ext" },
          " member, which it admits anywhere for your own vendor data. Humans can paste into the ",
          { text: "validator", href: "/validator/" },
          ", which runs entirely in the browser.",
        ],
      },
    ],
  },
  {
    heading: "System prompt",
    blocks: [
      {
        p: [
          "Drop this into the system prompt of a model you are asking for recipes:",
        ],
      },
      { code: SYSTEM_PROMPT },
    ],
  },
  { heading: "Examples", blocks: [{ examples: true }] },
  { heading: "Mistakes models actually make", blocks: [{ pitfalls: true }] },
  {
    heading: "Two rules worth repeating",
    blocks: [
      {
        p: [
          { strong: "Omit what you do not know." },
          " A document that says less is correct; a document that invents a water temperature is wrong, and it is wrong in a way no validator can catch. If the source did not state it, leave it out.",
        ],
      },
      {
        p: [
          { strong: "Unknown members are ignored, never rejected." },
          " That is what makes the format safe to extend, and it is why you should never write a consumer that fails on a key it does not recognize. See ",
          {
            text: "Versioning & conformance",
            href: "/docs/spec/07-versioning.md",
          },
          ".",
        ],
      },
    ],
  },
  {
    heading: "License and crawling",
    blocks: [
      {
        p: [
          "The spec prose, the schema, the fixtures, the registries, and the recipe corpus’s structure and transcription are ",
          { strong: "CC0" },
          " — public domain. You may quote, reproduce, and build on them freely, with no attribution required and no conditions attached. Quoted roaster prose inside corpus documents remains the quoted source’s, carried as attributed quotation.",
        ],
      },
      {
        p: [
          "Separately from the license, this website’s ",
          { text: "robots.txt", href: "/robots.txt" },
          " asks bulk training crawlers not to fetch it, while welcoming search and retrieval. That is a request about ",
          { em: "this server" },
          ", not a term of the license: a CC0 artifact carries no usage restriction, and nothing here adds one.",
        ],
      },
    ],
  },
];

/** Every href BOTH surfaces carry — the test that keeps the renderers level. */
export const guideHrefs = () =>
  GUIDE.flatMap((s) => s.blocks)
    .filter((b) => !b.htmlOnly)
    .flatMap((b) => [...(b.p ?? []), ...(b.ol ?? []).flat()])
    .filter((run) => typeof run === "object" && run.href)
    .map((run) => run.href);

/** Every heading below the `<h1>`, in order — the shape both renderers share. */
export const guideHeadings = () => GUIDE.map((s) => s.heading).filter(Boolean);

// --- HTML ------------------------------------------------------------------

const htmlRun = (run) => {
  if (typeof run === "string") return esc(run);
  if (run.href) {
    const label = run.code ? `<code>${esc(run.text)}</code>` : esc(run.text);
    return `<a href="${esc(run.href)}">${label}</a>`;
  }
  if (run.code) return `<code>${esc(run.code)}</code>`;
  if (run.strong) return `<strong>${esc(run.strong)}</strong>`;
  return `<em>${esc(run.em)}</em>`;
};

const htmlRuns = (runs) => runs.map(htmlRun).join("");
const jsonBlock = (v) => esc(JSON.stringify(v, null, 2));

const htmlBlock = (b) => {
  if (b.p) return `<p${b.muted ? ' class="muted"' : ""}>${htmlRuns(b.p)}</p>`;
  if (b.ol)
    return `<ol>${b.ol.map((li) => `<li>${htmlRuns(li)}</li>`).join("")}</ol>`;
  if (b.code) return `<pre><code>${esc(b.code)}</code></pre>`;
  if (b.examples)
    return EXAMPLES.map(
      (e) =>
        `<h3>${esc(e.prompt)}</h3><p class="muted">${esc(e.note)}</p><pre><code>${jsonBlock(e.doc)}</code></pre>`,
    ).join("");
  return `<table class="pitfalls"><thead><tr><th>Wrong</th><th>Right</th><th>Why</th></tr></thead><tbody>${PITFALLS.map(
    (p) =>
      `<tr><td><code>${esc(p.wrong)}</code></td><td><code>${esc(p.right)}</code></td><td>${esc(p.why)}</td></tr>`,
  ).join("")}</tbody></table>`;
};

/** The guide as page markup, `<h1>` excluded — the page module owns that. */
export const guideHtml = () =>
  GUIDE.map(
    (s) =>
      (s.heading ? `<h2>${esc(s.heading)}</h2>` : "") +
      s.blocks.map(htmlBlock).join(""),
  ).join("");

// --- Markdown --------------------------------------------------------------

/** Site-relative in HTML, absolute here: this file is read away from the site. */
const abs = (href, siteUrl) =>
  href.startsWith("/") ? `${siteUrl}${href}` : href;

const mdRun = (run, siteUrl) => {
  if (typeof run === "string") return run;
  if (run.href)
    return `[${run.code ? `\`${run.text}\`` : run.text}](${abs(run.href, siteUrl)})`;
  if (run.code) return `\`${run.code}\``;
  if (run.strong) return `**${run.strong}**`;
  return `*${run.em}*`;
};

const mdRuns = (runs, siteUrl) => runs.map((r) => mdRun(r, siteUrl)).join("");
// A cell is one line: the pipe is the column separator and a newline ends the row.
const cell = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdBlock = (b, siteUrl) => {
  if (b.p) return mdRuns(b.p, siteUrl);
  if (b.ol)
    return b.ol.map((li, i) => `${i + 1}. ${mdRuns(li, siteUrl)}`).join("\n");
  if (b.code) return `\`\`\`\n${b.code}\n\`\`\``;
  if (b.examples)
    return EXAMPLES.map(
      (e) =>
        `### ${e.prompt}\n\n${e.note}\n\n\`\`\`json\n${JSON.stringify(e.doc, null, 2)}\n\`\`\``,
    ).join("\n\n");
  return [
    "| Wrong | Right | Why |",
    "| --- | --- | --- |",
    ...PITFALLS.map(
      (p) => `| \`${cell(p.wrong)}\` | \`${cell(p.right)}\` | ${cell(p.why)} |`,
    ),
  ].join("\n");
};

/**
 * The guide as markdown sections — no `# ` title and no footer, mirroring
 * `guideHtml`. `tools/gen.mjs` wraps it into `/agents.md`, whose opening
 * sections describe the site itself.
 *
 * @param {string} siteUrl origin, no trailing slash
 */
export const guideMarkdown = (siteUrl) =>
  GUIDE.flatMap((s) => [
    ...(s.heading ? [`## ${s.heading}`, ""] : []),
    ...s.blocks
      .filter((b) => !b.htmlOnly)
      .flatMap((b) => [mdBlock(b, siteUrl), ""]),
  ]).join("\n");
