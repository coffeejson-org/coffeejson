#!/usr/bin/env node
// Build-time generation for apps/site. Fails the build on an invalid corpus.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
// The one workspace import here, and no new dependency: `src/pages/recipes.ts`
// imports the same package. Reimplementing the exporter would be worse — the
// corpus pages and `/r` must emit the same Recipe for the same document.
import {
  beanJsonLd,
  decodePayload,
  defaultLabels,
  encodePayload,
  fmtClock,
  fmtMeasurement,
  formatRatio,
  methodLabel,
  normalize,
  originLine,
  processLine,
  recipeJsonLd,
  scopeToRecipe,
  vocabularyLabel,
} from "@coffeejson/core";
// The schema through the package, not a path into the repo: the same offline,
// version-locked bytes any adopter gets.
import runtimeSchema from "@coffeejson/core/schema" with { type: "json" };
import authoringSchema from "@coffeejson/core/schema/authoring" with {
  type: "json",
};
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
// The page footers, shared with the hand-written pages so the license and
// privacy wording has exactly one source across generated and authored HTML.
import { guideMarkdown } from "../src/lib/agent-guide.mjs";
import {
  CORRECTIONS,
  CRAWLERS_UNCHANGED,
  footerHtml,
  LICENSE_CORPUS,
  PRIVACY,
  QUOTED_PROSE,
} from "../src/lib/footer.mjs";
import { siteHeader } from "../src/lib/site-header.mjs";
import { esc, slugify } from "../src/lib/text.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const repo = join(site, "..", "..");
const die = (msg) => {
  console.error(`gen: ${msg}`);
  process.exit(1);
};

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(runtimeSchema);

// Through `@coffeejson/core`, never a table kept here: a local unit table is a
// copy of a vocabulary the schema defines, and one without `milliliter` renders
// a volume-water recipe with no Water row. A quantity is a point OR a range, and
// a point-only reader prints every roaster's dial-in window as "undefined g".
const fmt = fmtMeasurement;
// `methodLabel` returns "" for an absent method and "Other" for one this build
// does not know; the pages want "Other" for both, so the fallback is stated here
// rather than kept as a second copy of the vocabulary.
const method = (m) => methodLabel(m) || "Other";

export const SITE_URL = "https://coffeejson.org";

// The TRAILING-SLASH form: Pages 301s bare `/r`, and a printed QR should not
// depend on a redirect that costs a round trip and can drop the payload. Inbound
// `/r?d=` still works, because the parser reads `location.search` only. A host
// detail: the spec's transport form stays `https://<host>/r?d=`.
export const SHARE_PATH = "/r/?d=";

// A payload this long makes a dense QR, which a phone camera reads slowly or not
// at all. A warning, never a truncation: a shortened document is a wrong one.
const warnDense = (subject, urlLength) => {
  if (urlLength > 2500)
    console.warn(
      `gen: WARN ${subject} encoded URL is ${urlLength} bytes (> 2500) — QR density risk; trim the document, never truncate`,
    );
};

// ONE source of truth for the sitemap and the robots test: a page advertised in
// the sitemap while robots.txt blocks it is what a prefix `Disallow` causes, one
// line shadowing a whole collection. Paths carry the trailing slash Pages serves,
// and the canonical tags use exactly these URLs.
export const INDEXABLE_PATHS = [
  "/",
  "/validator/",
  "/r/",
  "/recipes/",
  "/generate/",
  "/agents/",
  "/implementations/",
  "/beans/",
  "/showcase/",
];
export const indexableUrls = () =>
  INDEXABLE_PATHS.map((p) => `${SITE_URL}${p}`);

export function buildSitemap(urls = indexableUrls()) {
  const body = urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// The machine-readable front door, per llmstxt.org: an H1, a blockquote summary,
// then link sections. Both files are DERIVED — llms.txt from the doc registry
// below, llms-full.txt from the markdown on disk — because a hand-maintained copy
// of a spec goes stale silently.

const SUMMARY =
  "CoffeeJSON is an open, locale-neutral JSON format for sharing coffee recipes and bean identity. " +
  "A recipe stops being a screenshot and becomes data any app can read, validate, and brew from. " +
  "The spec prose and the JSON Schema are CC0 — public domain, no attribution required, no conditions.";

// title · path in the repo · one-line description. Order is reading order.
const SPEC_DOCS = [
  [
    "Overview",
    "docs/spec/01-overview.md",
    "What CoffeeJSON is, the design rules, and how to read the spec",
  ],
  [
    "Document envelope",
    "docs/spec/02-envelope.md",
    "The top-level shape: the `coffeejson` version string, `recipes[]`, `beans[]`, `tastings[]`",
  ],
  [
    "Recipe",
    "docs/spec/03-recipe.md",
    "Recipe fields: quantities, `basis`, steps, grind, gear, attribution, scaling",
  ],
  [
    "Bean",
    "docs/spec/04-bean.md",
    "Bean identity: roaster, origin, process, roast level, altitude",
  ],
  [
    "Tasting",
    "docs/spec/05-tasting.md",
    "How a brewed cup turned out: the drinker's impression, and what an instrument read",
  ],
  [
    "Vocabularies & registries",
    "docs/spec/06-vocabularies.md",
    "The controlled value sets, how they extend, and the fallback rules",
  ],
  [
    "Versioning & conformance",
    "docs/spec/07-versioning.md",
    "Compatibility contract, reserved extensions, what conformance requires",
  ],
];

const GUIDE_DOCS = [
  [
    "Integration guide",
    "docs/integration-guide.md",
    "The consumer and producer checklists: intake, decode, fallback rules, preservation, authoring lint, share links",
  ],
  [
    "Transport",
    "docs/transport.md",
    "Carrying a document in a URL or QR code: encoding, size limits, fallbacks",
  ],
];

const link = (title, url, description) =>
  `- [${title}](${url}): ${description}`;
const docUrl = (p) => `${SITE_URL}/${p}`;

// Where a repo path lives when it is not served from the site. Blob URLs so a
// file target renders; GitHub redirects a directory hit to /tree/ itself.
export const GITHUB_BLOB =
  "https://github.com/coffeejson-org/coffeejson/blob/main";

// The agent skills live in a sibling repository, not on this host — the one
// place llms.txt points off-site. `tests/llms.test.ts` allows exactly these.
const SKILLS_REPO = "https://github.com/coffeejson-org/skills";
export const SKILLS_LINKS = [
  [
    "Agent skills",
    SKILLS_REPO,
    "Three skills, one per relationship to the format, for a coding agent that reads `SKILL.md`. Install with `npx skills add coffeejson-org/skills`, or as a Claude Code plugin",
  ],
  [
    "coffeejson-schema",
    `${SKILLS_REPO}/tree/main/skills/coffeejson-schema`,
    "Changing the format: validating the schema and its corpora, designing a field, rename or reshape, and landing it fixture-first",
  ],
  [
    "coffeejson-integration",
    `${SKILLS_REPO}/tree/main/skills/coffeejson-integration`,
    "Adding CoffeeJSON to an app, service, site or script: intake and export checklists, the failure vocabulary, the version gate, the transport bindings, and proving conformance",
  ],
  [
    "coffeejson-author",
    `${SKILLS_REPO}/tree/main/skills/coffeejson-author`,
    "Turning one published source into a document: faithful transcription, where each fact lands, the vocabularies and registries, and the authoring lint",
  ],
];

// Every markdown file the site serves under /docs/ — the two llms lists plus
// the docs index, which other docs link as their directory map.
export const SERVED_MD = [
  ...SPEC_DOCS.map(([, p]) => p),
  ...GUIDE_DOCS.map(([, p]) => p),
  "docs/README.md",
];
const SERVED_MD_SET = new Set(SERVED_MD);

// Relative links resolve on GitHub and not from the site root (`../schema/…`
// escapes /docs/), so the SERVED copies get every relative link rewritten to an
// absolute URL while the repo copies stay relative. Pure fragments are untouched.
export function rewriteDocLinks(markdown, docPath) {
  const dir = posix.dirname(docPath);
  return markdown.replace(/\]\(([^)]+)\)/g, (whole, inside) => {
    const [rawTarget, ...titleParts] = inside.split(/\s+/);
    if (!rawTarget || rawTarget.startsWith("#")) return whole;
    if (/^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) return whole; // already absolute (https:, mailto:, …)
    const hash = rawTarget.indexOf("#");
    const target = hash === -1 ? rawTarget : rawTarget.slice(0, hash);
    const frag = hash === -1 ? "" : rawTarget.slice(hash);
    const resolved = posix
      .normalize(posix.join(dir, target))
      .replace(/\/$/, "");
    let url;
    if (resolved === "docs/schema/coffeejson-1.0.schema.json")
      url = `${SITE_URL}/schema/1.0`;
    else if (resolved === "docs/schema/coffeejson-1.0.authoring.schema.json")
      url = `${SITE_URL}/schema/authoring/1.0`;
    else if (SERVED_MD_SET.has(resolved) || resolved.startsWith("registries/"))
      url = `${SITE_URL}/${resolved}`;
    else url = `${GITHUB_BLOB}/${resolved}`;
    const title = titleParts.length ? ` ${titleParts.join(" ")}` : "";
    return `](${url}${frag}${title})`;
  });
}

export function buildLlmsTxt() {
  return [
    "# CoffeeJSON",
    "",
    `> ${SUMMARY}`,
    "",
    "## Specification",
    "",
    ...SPEC_DOCS.map(([t, p, d]) => link(t, docUrl(p), d)),
    "",
    "## Guides",
    "",
    ...GUIDE_DOCS.map(([t, p, d]) => link(t, docUrl(p), d)),
    "",
    "## Machine-readable",
    "",
    link(
      "JSON Schema (v1.0)",
      `${SITE_URL}/schema/1.0`,
      "The normative schema, served at its `$id`. Validate any document against this",
    ),
    link(
      "Authoring schema",
      `${SITE_URL}/schema/authoring/1.0`,
      "Stricter variant for generators: rejects unknown keys apart from the reserved `ext`, so a typo fails loudly instead of being ignored",
    ),
    link(
      "Gear registry",
      `${SITE_URL}/registries/gear.json`,
      "Canonical equipment slugs (id · label · brand/model) for the Gear id field",
    ),
    link(
      "Varietal registry",
      `${SITE_URL}/registries/varietals.json`,
      "Canonical varietal names plus aliases for common synonyms and breeding codes",
    ),
    link(
      "Addition-type registry",
      `${SITE_URL}/registries/addition-types.json`,
      "Recommended values for an addition's type — an open set, so any other string is valid",
    ),
    link(
      "Producer-role registry",
      `${SITE_URL}/registries/producer-roles.json`,
      "Recommended values for a party's role — an open set, so any other string is valid",
    ),
    link(
      "Implementations registry",
      `${SITE_URL}/registries/implementations.json`,
      "Self-declared implementations — apps, services, libraries — and the transport surfaces each reads and writes",
    ),
    link(
      "Full spec as one document",
      `${SITE_URL}/llms-full.txt`,
      "Every chapter concatenated, for loading into a single context",
    ),
    link(
      "Agent instructions",
      `${SITE_URL}/agents.md`,
      "The canonical agent-facing description of this site: what it serves, how to emit and validate a document, and what the crawl policy asks",
    ),
    "",
    "## Tools",
    "",
    link(
      "Validator",
      `${SITE_URL}/validator/`,
      "Paste a document, URL, or file and check it against the schema — runs entirely in the browser",
    ),
    link(
      "Recipe directory",
      `${SITE_URL}/recipes/`,
      "Transcribed real-world recipes as valid documents; each names and links its source. The same corpus by bag at ?view=beans — bean identity, roaster, origin, and the recipes brewed with it",
    ),
    link(
      "Generator",
      `${SITE_URL}/generate/`,
      "Build a valid document from a form, then share it as a link, QR code, or file",
    ),
    link(
      "For AI agents",
      `${SITE_URL}/agents/`,
      "How to emit valid CoffeeJSON: a system-prompt snippet, worked examples, the mistakes models make, and the validate-and-fix loop",
    ),
    link(
      "Implementations",
      `${SITE_URL}/implementations/`,
      "The reference SDKs for TypeScript and Swift, the conformance corpus any implementation can run against its own code, and the self-declared registry of apps that read and write the format",
    ),
    link(
      "Showcase",
      `${SITE_URL}/showcase/`,
      "The five places a CoffeeJSON document goes — between two apps, on a bag of coffee as a QR code, inside a share link, on a web page as schema.org Recipe or Product, and as a plain file you keep — plus the software that reads and writes the format today",
    ),
    "",
    "## Agent skills",
    "",
    ...SKILLS_LINKS.map(([t, u, d]) => link(t, u, d)),
    "",
    "## Notes",
    "",
    "- License: the spec prose, schema, fixtures, registries, and the corpus's structure and transcription are CC0 — no attribution required, no conditions. Quoted roaster prose inside corpus documents remains the quoted source's, carried with attribution. The SDK packages (@coffeejson/core, @coffeejson/react, coffeejson-swift) are Apache-2.0.",
    "- Every document declares its version in the `coffeejson` key; compatibility rules are in the versioning chapter.",
    "- Units are explicit and canonical (grams, celsius, bar) — never inferred from locale.",
    "- Interoperability, measured field by field against the public data models of the Visualizer and BeanConqueror projects: on the bean side one field in sixteen had no home in CoffeeJSON. Either could read the format without a schema change.",
    "- A whole recipe fits in a QR code. Documents travel as a file, as a share URL carrying the document in the query string, or as that URL printed as a QR — no server, no account, no lookup.",
    "- What CoffeeJSON is not: it is not a control-profile format (pressure and flow curves over time belong to formats like OEPF), not a cupping-score format (no cup-score field exists — a score without its scale is worse than no score), and not a service. There is nothing to sign up for and no endpoint to call.",
    "- Minimum valid document: the `coffeejson` version string, a recipe `title`, a `coffee` quantity, and either a `water` quantity or a ratio. A reader is required to ignore members it does not know, so documents stay readable as the format grows.",
    "",
  ].join("\n");
}

// `/agents.md`, per the convention the name carries: not a teaching document
// about the format but a description of THIS SITE for an agent — what it serves,
// what it can be asked for, and what it asks back. The emission guide is inlined
// rather than linked, because emitting a valid document is the thing an agent
// comes here to do, and a file it already fetched beats a second round trip.
//
// `llms.txt` stays the llmstxt.org link index rather than a mirror of this. The
// two answer different questions — "what is published here" and "how do I act
// here" — and collapsing them would cost the index without improving this.
export function buildAgentsMd(guide = guideMarkdown(SITE_URL)) {
  const doc = (title, path, description) =>
    `- **${title}** — \`GET ${path}\`. ${description}`;
  return `${[
    "# Agent Instructions — CoffeeJSON",
    "",
    `This document describes how AI agents can work with CoffeeJSON and its canonical site at ${SITE_URL}.`,
    "",
    `> ${SUMMARY}`,
    "",
    "There is no service here. No account, no key, no endpoint to call: every surface below is a plain unauthenticated GET of a static file, and the format artifacts are public domain.",
    "",
    "## What an agent does here",
    "",
    "1. **Emit** a CoffeeJSON document from a source — a brew guide, a bag, a product page. The guide for that is inlined below.",
    "2. **Validate** it against the authoring schema, and fix what it rejects.",
    "3. **Read** the specification, a chapter at a time or all at once.",
    "4. **Consume** documents in your own software, through a published SDK or your own parser.",
    "",
    "## Machine-readable surfaces",
    "",
    doc(
      "Schema",
      `${SITE_URL}/schema/1.0`,
      "The normative runtime schema, served at its `$id`. Permissive by design: a reader ignores members it does not recognize.",
    ),
    doc(
      "Authoring schema",
      `${SITE_URL}/schema/authoring/1.0`,
      "The strict variant. Closes every object apart from the reserved `ext`, so a typo fails loudly. **Generators validate against this one.**",
    ),
    doc(
      "Specification",
      `${SITE_URL}/docs/spec/01-overview.md`,
      `Seven chapters, \`01-overview\` through \`07-versioning\`, served as markdown.`,
    ),
    doc(
      "Integration guide",
      `${SITE_URL}/docs/integration-guide.md`,
      "The consumer and producer checklists. `/docs/transport.md` covers URLs and QR codes.",
    ),
    doc(
      "Whole specification, one file",
      `${SITE_URL}/llms-full.txt`,
      "Every chapter concatenated, for loading into a single context.",
    ),
    doc(
      "Link index",
      `${SITE_URL}/llms.txt`,
      "Every published surface as an llmstxt.org index.",
    ),
    doc(
      "Registries",
      `${SITE_URL}/registries/gear.json`,
      "Curated open value sets. Also `varietals`, `addition-types`, `producer-roles`, and `implementations` — the self-declared list of software that reads and writes the format.",
    ),
    doc("Sitemap", `${SITE_URL}/sitemap.xml`, "Every indexable page."),
    doc(
      "Crawl policy",
      `${SITE_URL}/robots.txt`,
      "Retrieval and search welcome; bulk training crawlers asked away. See the closing section.",
    ),
    "",
    `**Agent discovery:** this document (\`/agents.md\`) is the canonical agent-facing description of this site. ${SITE_URL}/agents/ renders the same guide for a reader with a browser.`,
    "",
    "## The corpus",
    "",
    "Real recipes transcribed from published sources, each naming and linking its own.",
    "",
    doc(
      "Directory",
      `${SITE_URL}/recipes/`,
      "Every transcribed recipe. The same corpus by bag at `?view=beans`.",
    ),
    doc(
      "One recipe",
      `${SITE_URL}/recipes/<slug>/`,
      "HTML carrying a schema.org `Recipe` as `ld+json`.",
    ),
    doc(
      "One bag",
      `${SITE_URL}/beans/<slug>/`,
      "HTML carrying a schema.org `Product` as `ld+json`.",
    ),
    "",
    "The CoffeeJSON documents themselves are not served as JSON here — they live in the repository, under `recipes/` at https://github.com/coffeejson-org/coffeejson, where each is a file you can fetch raw.",
    "",
    "## Tools",
    "",
    "- **Agent skills** — `npx skills add coffeejson-org/skills` installs three: changing the format, adding it to a product, and turning a published source into a document.",
    "- **TypeScript** — `npm i @coffeejson/core` for validation, normalization, share-link encoding and schema.org export; `@coffeejson/react` for rendering.",
    "- **Swift** — `coffeejson-swift`, at https://github.com/coffeejson-org/coffeejson-swift.",
    `- **In a browser** — ${SITE_URL}/validator/ checks a pasted document entirely client-side, and ${SITE_URL}/generate/ builds one from a form.`,
    "",
    // The wrapper owns the document's structure, so the heading over the guide
    // is here rather than in `GUIDE` — the page has an `<h1>` saying it already.
    "## Emitting a document",
    "",
    guide,
    "---",
    "",
    `${LICENSE_CORPUS} ${CRAWLERS_UNCHANGED} ${PRIVACY}`,
  ].join("\n")}\n`;
}

export function buildLlmsFullTxt(
  read = (p) => readFileSync(join(repo, p), "utf8"),
) {
  const parts = [
    "# CoffeeJSON — the complete specification",
    "",
    `> ${SUMMARY}`,
    "",
    `Generated from the repository. Canonical home: ${SITE_URL}`,
    "",
    "---",
    "",
  ];
  for (const [, path] of [...SPEC_DOCS, ...GUIDE_DOCS]) {
    parts.push(
      `<!-- source: ${path} -->`,
      "",
      rewriteDocLinks(read(path).trimEnd(), path),
      "",
      "---",
      "",
    );
  }
  return parts.join("\n");
}

// The corpus, read once in catalog order and validated. Both projections below
// — the recipe index and the bean index — walk this same list, so the two views
// of /recipes can never disagree about which documents exist or what they say.
function readCorpus() {
  const dir = join(repo, "recipes");
  const catalog = JSON.parse(readFileSync(join(dir, "catalog.json"), "utf8"));
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".json") && f !== "catalog.json",
  );
  const fileSlugs = new Set(files.map((f) => basename(f, ".json")));
  const catSlugs = new Set(catalog.recipes.map((r) => r.slug));
  for (const s of catSlugs)
    if (!fileSlugs.has(s)) die(`catalog names ${s}.json which does not exist`);
  for (const s of fileSlugs)
    if (!catSlugs.has(s)) die(`${s}.json has no catalog entry`);

  return catalog.recipes.map((entry) => {
    const doc = JSON.parse(
      readFileSync(join(dir, `${entry.slug}.json`), "utf8"),
    );
    if (!validate(doc))
      die(
        `${entry.slug}.json is not a valid CoffeeJSON document:\n` +
          (validate.errors ?? [])
            .map((e) => `  ${e.instancePath || "/"} ${e.message}`)
            .join("\n"),
      );
    return { entry, doc };
  });
}

export function buildIndex(corpus = readCorpus()) {
  // ONE CARD PER RECIPE, not per document: a roaster's product page routinely
  // publishes one bag with three brew methods, and every field below except the
  // payload is a property of the recipe. Reading `recipes[0]` drops the rest
  // silently, and /r would render three where the directory advertised one.
  return corpus.flatMap(({ entry, doc }) => {
    const recipes = doc.recipes ?? [];
    // A product page publishing a bag and no method is a complete transcription:
    // no recipe card, surfacing through the bean lens, and still owing an
    // attribution pair — asserted on the bean, which has no `author`/`based_on`.
    const beans = doc.beans ?? [];
    if (recipes.length === 0) {
      if (beans.length === 0)
        die(`${entry.slug}.json carries neither a recipe nor a bean`);
      beans.forEach((b, i) => {
        if (!b.roaster?.name)
          die(
            `${entry.slug}.json bean ${i} carries no roaster name — a bean-only document must credit who roasted it`,
          );
        if (!b.url)
          die(
            `${entry.slug}.json bean ${i} carries no url — a bean-only document must link its source`,
          );
      });
      warnDense(
        entry.slug,
        `${SITE_URL}${SHARE_PATH}`.length + encodePayload(doc).length,
      );
      return [];
    }
    const payload = encodePayload(doc);
    // Measured on the WHOLE document: scoping shrinks a card, not a publication,
    // and this warning is about what the publication costs to carry.
    warnDense(entry.slug, `${SITE_URL}${SHARE_PATH}`.length + payload.length);

    // Index-aligned with `recipes`: every corpus document validated above, so
    // every element is an object and `normalize` drops none of them.
    const projected = normalize(doc).recipes;
    if (projected.length !== recipes.length)
      die(
        `${entry.slug}.json: ${recipes.length} recipes on the wire, ${projected.length} projected`,
      );

    return recipes.map((r, i) => {
      const n = projected[i];
      // Attribution lives in the documents; the catalog holds only what they cannot.
      // Every corpus recipe is a transcription, so both are required of EVERY recipe
      // in the document, not merely the first one anybody looked at.
      if (!r.author?.name)
        die(
          `${entry.slug}.json recipe ${i} carries no author — corpus recipes are transcriptions and must credit one`,
        );
      if (!r.based_on)
        die(
          `${entry.slug}.json recipe ${i} carries no based_on — corpus recipes must link their source`,
        );
      return {
        // The document's slug — the catalog key, the `?s=` short-link target, and
        // the download filename. Shared by every card the document produces.
        slug: entry.slug,
        // This card's own identity. Identical to the slug while a document holds
        // one recipe; a document holding several appends `#n`, so a card keeps its
        // own address whatever else the document carries.
        id: recipes.length > 1 ? `${entry.slug}#${i + 1}` : entry.slug,
        /** How many recipes the source document carries — 1 for a lone recipe. */
        siblings: recipes.length,
        title: n.title,
        author: partyEntry(n.author),
        method: n.method ?? "other",
        methodLabel: method(n.method),
        coffee: fmt(n.coffee),
        brew: n.isEspresso ? fmt(n.yield) : fmt(n.water),
        ratio: formatRatio(n.ratio),
        temp: fmt(n.waterTemp),
        totalTime: n.finishS !== null ? fmtClock(n.finishS) : "",
        stepCount: n.steps.length,
        attribution: {
          source_url: r.based_on,
          source_label: entry.attribution.source_label,
          transcribed: entry.attribution.transcribed,
        },
        // THIS CARD'S OWN DOCUMENT, not the publication it came from: handing over
        // the whole gives a reader recipes they did not ask for. For a single-recipe
        // document the projection is the identity.
        payload: encodePayload(scopeToRecipe(doc, i)),
      };
    });
  });
}

// The bean lens: the same corpus, projected by bag instead of by brew. Every card
// is derived from beans the transcriptions already carry, at build time, so the
// page stays a dumb renderer and the projection deterministic.

// A bean page is addressed by the bag, not by the document that transcribes it.
// The slug is `<roaster>-<bean>`, and the roaster half is a TABLE because no rule
// folds every registered name right: `fuglen` drops a location, `lightup` closes
// up, `drink-coffee-do-stuff` keeps "coffee" because the brand is the sentence.
// `&` drops rather than becoming "and", matching the gear registry.
const ROASTER_SLUG = {
  "April Coffee Roasters": "april",
  "Black & White Coffee Roasters": "black-white",
  "Cat & Cloud": "cat-cloud",
  "DRINK COFFEE DO STUFF": "drink-coffee-do-stuff",
  "Dak Coffee Roasters": "dak",
  "Dune Coffee Roasters": "dune",
  "Equator Coffees": "equator",
  "FUGLEN COFFEE ROASTERS TOKYO": "fuglen",
  "GLITCH COFFEE & ROASTERS": "glitch",
  "HORIGUCHI COFFEE": "horiguchi",
  "Hydrangea Coffee Roasters": "hydrangea",
  "LIGHT UP COFFEE": "lightup",
  "Linea Caffe": "linea",
  "ONIBUS COFFEE": "onibus",
  "Onyx Coffee Lab": "onyx",
  PHILOCOFFEA: "philocoffea",
  "Saint Frank": "saint-frank",
  "Sightglass Coffee": "sightglass",
  "Stumptown Coffee Roasters": "stumptown",
  "Tim Wendelboe": "tim-wendelboe",
  "Verve Coffee": "verve",
  サザコーヒー: "saza",
};

const isAscii = (s) => /^[\x20-\x7E]*$/.test(s);

/**
 * The bean half of the slug. A Latin-script name folds; a name in another
 * script cannot (katakana is not a diacritic), so it is taken from the document
 * slug, where the transliteration was already made at transcription time —
 * one answer in the corpus, not two. Unambiguous only while such a bag has
 * exactly one document, which is asserted rather than assumed.
 */
function beanSlugHalf(name, roasterSlug, docSlugs) {
  if (isAscii(name)) return slugify(name);
  if (docSlugs.length !== 1)
    die(
      `bean "${name}": a non-Latin name needs exactly one document to take its ` +
        `slug from, but has ${docSlugs.length} (${docSlugs.join(", ") || "none"})`,
    );
  const prefix = `${roasterSlug}-`;
  if (!docSlugs[0].startsWith(prefix))
    die(
      `bean "${name}": document slug "${docSlugs[0]}" does not start with "${prefix}", ` +
        `so the bean half cannot be read off it`,
    );
  return docSlugs[0].slice(prefix.length);
}

/**
 * The page slug for a bag, or `null` when this roaster has no table entry.
 * Null rather than a throw because this projection must stay total; a missing
 * slug becomes fatal in `buildBeanPages`, the step that would otherwise publish
 * a guess.
 */
export function beanPageSlug(roasterName, beanName, docSlugs = []) {
  const roaster = ROASTER_SLUG[roasterName];
  if (!roaster) return null;
  return `${roaster}-${beanSlugHalf(beanName, roaster, docSlugs)}`;
}

export const beanPagePath = (slug) => `/beans/${slug}/`;

// A page never spells a token, it reads a label. The tables live in the package,
// held equal to the schema there, so this file cannot drift from what a card shows.
const label = (table, token) => vocabularyLabel(table, token);
// Through `normalize`, so a static page and a `BeanCard` render one bag from one
// projection. `normalize` reads a document's collections, so the bean travels in
// one; nothing else in the envelope reaches it.
const projectBean = (b) => normalize({ beans: [b] }).beans[0] ?? null;

// What a card renders of a credited party. `role` and `type` are the
// projection's and no page reads them, so they stay out of the served index.
const partyEntry = (p) => ({ name: p.name, ...(p.url ? { url: p.url } : {}) });

// Items join with " + " (a blend reads as a sum) while the facts inside an item
// join with " · ", so the two levels stay tellable apart.
const originOf = (nb) =>
  (nb?.originItems ?? [])
    .map((it) => originLine(it, defaultLabels))
    .filter(Boolean)
    .join(" + ");

const roastOf = (nb, withDate) =>
  [
    label(defaultLabels.roastLevels, nb?.roastLevel),
    nb?.roastAgtron !== null && nb?.roastAgtron !== undefined
      ? `Agtron ${nb.roastAgtron}`
      : "",
    withDate ? (nb?.roastDate ?? "") : "",
  ]
    .filter(Boolean)
    .join(" · ");

export function buildBeansIndex(corpus = readCorpus()) {
  /** key → { instances: [{ bean, order, transcribed }], recipes: [] } */
  const byKey = new Map();
  const slot = (key) => {
    if (!byKey.has(key))
      byKey.set(key, { key, instances: [], recipes: [], documents: [] });
    return byKey.get(key);
  };
  // A bean with no roaster name or no name has no key, so it contributes no card.
  // Cannot happen in the corpus today; the guard keeps the projection total.
  const keyOf = (b) =>
    b?.roaster?.name && b?.name
      ? `${slugify(b.roaster.name)}/${slugify(b.name)}`
      : null;

  corpus.forEach(({ entry, doc }, order) => {
    const beans = (doc.beans ?? []).filter((b) => keyOf(b));
    for (const bean of beans) {
      slot(keyOf(bean)).instances.push({
        bean,
        order,
        coffeejson: doc.coffeejson,
        transcribed: entry.attribution?.transcribed ?? "",
      });
      // The UNION of the documents that describe the bag: an extracted bean has no
      // `author`/`based_on` of its own, so without this a bean page credits nobody
      // while its own recipe pages credit their sources.
      slot(keyOf(bean)).documents.push({
        slug: entry.slug,
        source_label: entry.attribution?.source_label ?? "",
        transcribed: entry.attribution?.transcribed ?? "",
        url: bean.url ?? null,
      });
    }

    for (const r of doc.recipes ?? []) {
      // An unresolved `bean_ref` leaves the recipe unlinked — the spec's rule, and
      // the honest one: guessing puts a recipe under a card its source never
      // associated it with. With no `bean_ref` the association is implicit.
      const targets =
        r.bean_ref !== undefined
          ? beans.filter((b) => b.id === r.bean_ref)
          : beans;
      const member = {
        slug: entry.slug,
        title: r.title,
        methodLabel: method(r.method),
      };
      for (const bean of targets) slot(keyOf(bean)).recipes.push(member);
    }
  });

  // ONE winning instance, never merged across documents: merging synthesizes a bag
  // no single source described. Richest first, then newest, then catalog order.
  return [...byKey.values()].map(({ key, instances, recipes, documents }) => {
    const [{ bean: b, coffeejson }] = [...instances].sort(
      (x, y) =>
        Object.keys(y.bean).length - Object.keys(x.bean).length ||
        y.transcribed.localeCompare(x.transcribed) ||
        x.order - y.order,
    );
    // The winning bean re-enveloped VERBATIM. `beans` and `recipes` are
    // independent in the envelope, so this is a complete document, not a fragment,
    // and every byte traces to one published transcription.
    const payload = encodePayload({ coffeejson, beans: [b] });
    warnDense(
      `bean ${key}`,
      `${SITE_URL}${SHARE_PATH}`.length + payload.length,
    );
    const nb = projectBean(b);
    return {
      key,
      name: b.name,
      roaster: partyEntry(nb.roaster),
      ...(nb.url ? { url: nb.url } : {}),
      origin: originOf(nb),
      process: processLine(nb?.process ?? [], defaultLabels),
      roast: roastOf(nb, true),
      notes: (nb?.roasterNotes ?? []).join(" · "),
      slug: beanPageSlug(
        b.roaster.name,
        b.name,
        documents.map((d) => d.slug),
      ),
      // Deduped by document: a document naming this bag twice credits it once.
      documents: [...new Map(documents.map((d) => [d.slug, d])).values()],
      recipes,
      payload,
    };
  });
}

/**
 * The publication a card was taken from, for "Get all N" and `?s=<slug>`. Emitted
 * ONLY where it differs from what the cards already carry: for a single-recipe
 * document the projection is the identity, and an entry would duplicate the card.
 */
export function buildDocuments(
  corpus = readCorpus(),
  index = buildIndex(corpus),
) {
  const cardPayloads = new Map();
  for (const e of index)
    if (!cardPayloads.has(e.slug)) cardPayloads.set(e.slug, e.payload);
  const out = {};
  for (const { entry, doc } of corpus) {
    if (!cardPayloads.has(entry.slug)) continue; // bean-only: no cards, nothing to get "all" of
    const whole = encodePayload(doc);
    if (whole !== cardPayloads.get(entry.slug)) out[entry.slug] = whole;
  }
  return out;
}

// ONE PAGE PER DOCUMENT, not per recipe: a page is what can be linked, cited and
// canonicalized — what `?s=` resolves and Download hands over. Multi-recipe
// documents render recipes as anchored sections. Rendered STATIC, not hydrated by
// /r: the document is known at build time, and a crawler should not need JS.
// Every generated page's <head>: only the title, description, canonical and the
// JSON-LD differ, and a second copy is where an og: tag goes missing on one of
// the two page kinds.
const pageHead = ({ title, description, url, ld }) => `<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#fdfdfc" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#141414" media="(prefers-color-scheme: dark)" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/src/styles.css" />${
      ld?.length
        ? `
    <script type="application/ld+json">${JSON.stringify(
      ld.length === 1 ? ld[0] : ld,
    ).replace(/</g, "\\u003c")}</script>`
        : ""
    }
  </head>`;

export const corpusPagePath = (slug) => `/recipes/${slug}/`;
/** Document slugs that produce at least one recipe card, in catalog order. */
export const corpusPageSlugs = (index = buildIndex()) => [
  ...new Set(index.map((e) => e.slug)),
];
export const corpusPageUrls = (index = buildIndex()) =>
  corpusPageSlugs(index).map((s) => `${SITE_URL}${corpusPagePath(s)}`);
/** Everything the sitemap advertises: the hand-written pages plus every corpus page. */
export const allIndexableUrls = (
  index = buildIndex(),
  beans = buildBeansIndex(),
) => [...indexableUrls(), ...corpusPageUrls(index), ...beanPageUrls(beans)];

const factsOf = (n) => {
  const out =
    fmt(n.coffee) +
    (n.isEspresso
      ? n.yield
        ? ` → ${fmt(n.yield)}`
        : ""
      : n.water
        ? ` → ${fmt(n.water)}`
        : "");
  // Gated on the LABEL, not the token: the grind scale has no `other` to fall
  // back to, so an unrecognized token labels as nothing and must print nothing.
  const grindSize = label(defaultLabels.grindSizes, n.grind?.size);
  return [
    out,
    formatRatio(n.ratio),
    fmt(n.waterTemp),
    n.finishS !== null ? `${fmtClock(n.finishS)} total` : "",
    grindSize ? `${grindSize} grind` : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

const stepsHtml = (n) =>
  n.steps.length === 0
    ? ""
    : `<ol class="steps">${n.steps
        .map((s) => {
          const when = s.atS !== null ? fmtClock(s.atS) : "";
          const to = fmt(s.toWater);
          const body = s.text || label(defaultLabels.stepKinds, s.kind);
          return (
            `<li><span class="t">${esc(when)}</span><span>${esc(body)}</span>` +
            (to ? `<span class="to muted">${esc(to)}</span>` : "") +
            `</li>`
          );
        })
        .join("")}</ol>`;

const beanHtml = (b) => {
  if (!b) return "";
  const nb = projectBean(b);
  const roasterName = nb?.roaster?.name ?? "";
  const who = nb?.roaster?.url
    ? `<a href="${esc(nb.roaster.url)}" rel="noopener">${esc(roasterName)}</a>`
    : esc(roasterName);
  const origin = originOf(nb);
  const rest = [
    processLine(nb?.process ?? [], defaultLabels),
    roastOf(nb, false),
  ].filter(Boolean);
  return `<section class="card bean-card"><h2>The bag</h2>
    <p><strong>${esc(nb?.name ?? "")}</strong>${who ? ` — ${who}` : ""}</p>
    ${origin ? `<p>${esc(origin)}</p>` : ""}
    ${rest.length ? `<p>${esc(rest.join(" · "))}</p>` : ""}
    ${
      (nb?.roasterNotes ?? []).length
        ? `<p class="muted"><em>${esc(nb.roasterNotes.join(" · "))}</em></p>`
        : ""
    }</section>`;
};

/**
 * Assemble a description from whole clauses, most-useful-first, dropping
 * trailing ones past what a result page shows (~155 chars). Never cuts
 * mid-word: an ellipsis reads as machine output.
 */
const clampClauses = (clauses, max = 155) => {
  let out = "";
  for (const c of clauses.filter(Boolean)) {
    const next = out ? `${out} ${c}` : c;
    if (next.length > max) break;
    out = next;
  }
  return out;
};

/** The page title and meta description a document earns. */
export function corpusPageMeta(entry, doc) {
  const recipes = doc.recipes ?? [];
  const projected = normalize(doc).recipes;
  const bean = doc.beans?.[0];
  const label = entry.attribution.source_label;
  if (recipes.length === 1) {
    const n = projected[0];
    const facts = factsOf(n);
    return {
      title: `${n.title} — CoffeeJSON`,
      description: clampClauses([
        `${n.title}, by ${n.author?.name ?? ""}.`,
        facts ? `${facts}.` : "",
        `Transcribed from ${label}.`,
      ]),
    };
  }
  // Titled for the subject — the bag where there is one, the source otherwise —
  // never for whichever recipe happened to be authored first.
  const subject = bean
    ? `${bean.roaster?.name ? `${bean.roaster.name} ` : ""}${bean.name}`
    : label;
  const methods = [...new Set(projected.map((n) => method(n.method)))].join(
    ", ",
  );
  return {
    title: `${subject} — ${recipes.length} brew methods — CoffeeJSON`,
    description: clampClauses([
      `${recipes.length} brew methods for ${subject}: ${methods}.`,
      `One open CoffeeJSON document, transcribed from ${label}.`,
    ]),
  };
}

export function buildCorpusPage(entry, doc) {
  const url = `${SITE_URL}${corpusPagePath(entry.slug)}`;
  const { title, description } = corpusPageMeta(entry, doc);
  const recipes = doc.recipes ?? [];
  const projected = normalize(doc).recipes;
  const multi = recipes.length > 1;
  // The WHOLE publication: `encodePayload(doc)` and not a card's payload, which
  // is a scoped projection and would share only the first recipe of a multi page.
  const payload = encodePayload(doc);
  const ld = recipes
    .map((_, i) =>
      recipeJsonLd(doc, i, { url: multi ? `${url}#recipe-${i + 1}` : url }),
    )
    .filter(Boolean);

  const sections = recipes
    .map((_, i) => {
      const n = projected[i];
      return `
    <section${multi ? ` id="recipe-${i + 1}"` : ""}>
      ${multi ? `<h2>${esc(n.title)}</h2>` : ""}
      <p class="muted">${esc(n.author?.name ?? "")} · ${esc(method(n.method))}${
        // A gear reference with no label or brand falls back to its id, which for
        // a plain french press IS the method name. Name the brewer only when it
        // says something the method did not.
        n.brewerLabel &&
        n.brewerLabel.toLowerCase() !== methodLabel(n.method).toLowerCase()
          ? ` · ${esc(n.brewerLabel)}`
          : ""
      }</p>
      <p>${esc(factsOf(n))}</p>
      ${n.description ? `<p>${esc(n.description)}</p>` : ""}
      ${stepsHtml(n)}
      ${n.notes ? `<p class="muted">${esc(n.notes)}</p>` : ""}
      <p class="attribution">Transcribed from
        <a href="${esc(n.basedOn)}" rel="noopener">${esc(entry.attribution.source_label)}</a>
        on ${esc(entry.attribution.transcribed)}</p>
      ${
        multi
          ? `<div data-share-slot data-payload="${esc(encodePayload(scopeToRecipe(doc, i)))}"
        data-file="${esc(entry.slug)}-${i + 1}" data-slug="${esc(entry.slug)}" data-i="${i + 1}"
        data-label="Take this brew${(doc.beans ?? []).length ? " and the bag" : " on its own"}"></div>`
          : ""
      }
    </section>`;
    })
    .join("");

  const author = projected[0].author?.name ?? "";
  const methodId = projected[0].method ?? "other";
  const related = `<nav class="row" aria-label="Related">
      <a href="/recipes/?author=${encodeURIComponent(slugify(author))}">More from ${esc(author)}</a>
      <a href="/recipes/?method=${encodeURIComponent(methodId)}">More ${esc(
        method(methodId).toLowerCase(),
      )}</a>
      <a href="/recipes/">All recipes</a>
    </nav>`;

  return `<!doctype html>
<html lang="${esc(projected[0].lang ?? "en")}">
  ${pageHead({ title, description, url, ld })}
  <body>
    <main id="app" data-slug="${esc(entry.slug)}">
      ${siteHeader(`/recipes/${entry.slug}/`)}
      <h1>${esc(multi ? corpusPageMeta(entry, doc).title.replace(/ — CoffeeJSON$/, "") : projected[0].title)}</h1>
      ${sections}
      <div data-share-slot data-payload="${esc(payload)}" data-file="${esc(entry.slug)}"
        data-slug="${esc(entry.slug)}"${multi ? ` data-label="Take the whole publication — all ${recipes.length} brews"` : ""}></div>
      ${beanHtml(doc.beans?.[0])}
      ${related}
      ${footerHtml(LICENSE_CORPUS, QUOTED_PROSE, CORRECTIONS)}
    </main>
    <script type="module" src="/src/pages/corpus.ts"></script>
    <script type="module" src="/src/lib/analytics.ts"></script>
  </body>
</html>
`;
}

/**
 * One page per bean identity — the bag, not the transcription of it. Its JSON-LD
 * is a schema.org `Product` with no `offers`: the page already names the roaster's
 * listing under Sources, and the node says the same to a machine (`sameAs`),
 * asserting no sale at any price — the price lives on the listing.
 */
export function buildBeanPage(bean) {
  const url = `${SITE_URL}${beanPagePath(bean.slug)}`;
  // Decoded from the card's own payload rather than carried beside it: the index
  // ships to the browser, and a second copy of every bean would ride with it.
  const decoded = decodePayload(bean.payload);
  // This build encoded that payload three lines of call stack ago, so a decode
  // failure means the encoder broke — not that this bag is unusual. Failing open
  // would ship every bean page with no structured data on a green build.
  if (!decoded.ok) {
    const { kind, detail } = decoded.error;
    die(
      `bean "${bean.slug}": its own payload does not decode (${kind}${detail ? `: ${detail}` : ""}) — the page would ship with no JSON-LD`,
    );
  }
  const ld = [beanJsonLd(decoded.document, 0, { url })].filter(Boolean);
  const roasterName = bean.roaster?.name ?? "";
  const title = `${bean.name} — ${roasterName} — CoffeeJSON`;
  const description = [bean.name, roasterName, bean.origin, bean.notes]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 300);
  const who = bean.roaster?.url
    ? `<a href="${esc(bean.roaster.url)}" rel="noopener">${esc(roasterName)}</a>`
    : esc(roasterName);

  const facts = [
    ["Origin", bean.origin],
    ["Process", bean.process],
    ["Roast", bean.roast],
    ["Roaster's notes", bean.notes],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<p><span class="muted">${k}</span> — ${esc(v)}</p>`)
    .join("");

  // Grouped by the document that states them, so a reader sees WHICH publication
  // said what rather than a flat list that merges two sources.
  const byDoc = new Map();
  for (const r of bean.recipes)
    byDoc.set(r.slug, [...(byDoc.get(r.slug) ?? []), r]);
  const brews = byDoc.size
    ? `<h2>Brewed with it</h2><ul class="bean-recipes">${[...byDoc]
        .map(([slug, rs]) =>
          rs
            .map(
              (r) =>
                `<li><a href="${esc(corpusPagePath(slug))}">${esc(r.title)}</a>
          <span class="muted">${esc(r.methodLabel)}</span></li>`,
            )
            .join(""),
        )
        .join("")}</ul>`
    : `<p class="muted">No transcribed recipe names this bag yet — the sources that
       describe it publish the coffee without a brew method.</p>`;

  // An extracted bean has no `author`/`based_on` of its own, so the union of every
  // document describing the bag is the only place its provenance can come from.
  const sources = `<h2>Sources</h2><ul class="bean-sources">${bean.documents
    .map(
      (d) => `
    <li>${
      d.url
        ? `<a href="${esc(d.url)}" rel="noopener">${esc(d.source_label)}</a>`
        : esc(d.source_label)
    }
      <span class="muted">transcribed ${esc(d.transcribed)}</span>
      ${byDoc.has(d.slug) ? ` · <a href="${esc(corpusPagePath(d.slug))}">recipes</a>` : ""}</li>`,
    )
    .join("")}</ul>`;

  return `<!doctype html>
<html lang="en">
  ${pageHead({ title, description, url, ld })}
  <body>
    <main id="app" data-bean="${esc(bean.slug)}">
      ${siteHeader(beanPagePath(bean.slug))}
      <h1>${esc(bean.name)}</h1>
      <p class="muted">${who}</p>
      <section class="card">${facts}</section>
      <div data-share-slot data-payload="${esc(bean.payload)}" data-file="${esc(bean.slug)}"
        data-label="Take the bag"></div>
      ${brews}
      ${sources}
      <nav class="row" aria-label="Related">
        <a href="/beans/?roaster=${encodeURIComponent(slugify(roasterName))}">More from ${esc(roasterName)}</a>
        <a href="/beans/">All bags</a>
        <a href="/recipes/">All recipes</a>
      </nav>
      ${footerHtml(LICENSE_CORPUS, QUOTED_PROSE, CORRECTIONS)}
    </main>
    <script type="module" src="/src/pages/corpus.ts"></script>
    <script type="module" src="/src/lib/analytics.ts"></script>
  </body>
</html>
`;
}

export const beanPageSlugs = (beans = buildBeansIndex()) =>
  beans.map((b) => b.slug);
export const beanPageUrls = (beans = buildBeansIndex()) =>
  beanPageSlugs(beans).map((s) => `${SITE_URL}${beanPagePath(s)}`);

export function buildBeanPages(beans = buildBeansIndex()) {
  // Run at BUILD time rather than trusted: the gear registry's "curation catches
  // them at registration" does not apply, because nobody registers a bag.
  const seen = new Map();
  for (const b of beans) {
    if (!b.slug)
      die(
        `roaster "${b.roaster?.name}" has no slug (bag "${b.name}"). Add it to ` +
          `ROASTER_SLUG in gen.mjs — the name is not derivable from itself, ` +
          `which is the whole reason the table exists.`,
      );
    if (seen.has(b.slug))
      die(
        `bean slug collision: "${b.slug}" is claimed by both ${seen.get(b.slug)} and ${b.key}`,
      );
    seen.set(b.slug, b.key);
  }
  return beans.map((b) => ({
    slug: b.slug,
    path: beanPagePath(b.slug),
    html: buildBeanPage(b),
  }));
}

/** Every corpus page, keyed by the directory it is written to. */
export function buildCorpusPages(
  corpus = readCorpus(),
  index = buildIndex(corpus),
) {
  // A document with no card produced nothing to page: bean-only documents.
  const carded = new Set(index.map((e) => e.slug));
  return corpus
    .filter(({ entry }) => carded.has(entry.slug))
    .map(({ entry, doc }) => ({
      slug: entry.slug,
      path: corpusPagePath(entry.slug),
      html: buildCorpusPage(entry, doc),
    }));
}

const isMain =
  process.argv[1] &&
  fileURLToPath(new URL(process.argv[1], "file://")) ===
    fileURLToPath(import.meta.url);
if (isMain) {
  await (async () => {
    const index = buildIndex();
    mkdirSync(join(site, "src/generated"), { recursive: true });
    writeFileSync(
      join(site, "src/generated/recipes-index.json"),
      JSON.stringify(index, null, 2),
    );
    console.log(`gen: recipes-index.json — ${index.length} recipes`);

    const documents = buildDocuments();
    writeFileSync(
      join(site, "src/generated/documents-index.json"),
      JSON.stringify(documents, null, 2),
    );
    console.log(
      `gen: documents-index.json — ${Object.keys(documents).length} publications a card does not already carry whole`,
    );

    const beans = buildBeansIndex();
    writeFileSync(
      join(site, "src/generated/beans-index.json"),
      JSON.stringify(beans, null, 2),
    );
    console.log(
      `gen: beans-index.json — ${beans.length} beans from ` +
        `${beans.reduce((n, b) => n + b.recipes.length, 0)} recipe links`,
    );

    // Just the figures, as their own file: the landing page renders none of the
    // corpus, and importing the two indexes for a `.length` costs it a third of a
    // megabyte that vite then modulepreloads. Derived so the numbers cannot
    // disagree with the pages they link to.
    const counts = {
      recipes: index.length,
      beans: beans.length,
      roasters: new Set(beans.map((b) => b.roaster?.name).filter(Boolean)).size,
    };
    writeFileSync(
      join(site, "src/generated/corpus-counts.json"),
      `${JSON.stringify(counts, null, 2)}\n`,
    );
    console.log(
      `gen: corpus-counts.json — ${counts.recipes} recipes · ` +
        `${counts.beans} beans · ${counts.roasters} roasters`,
    );

    // Schema at its $id path — exact bytes, plus a convenience alias. The
    // authoring (strict) variant is what a GENERATING consumer wants: it rejects
    // unknown keys apart from the reserved `ext`, so a typo fails loudly instead
    // of being ignored by the open runtime schema.
    mkdirSync(join(site, "public/schema/authoring"), { recursive: true });
    const schemaBytes = readFileSync(
      join(repo, "docs/schema/coffeejson-1.0.schema.json"),
    );
    writeFileSync(join(site, "public/schema/1.0"), schemaBytes);
    writeFileSync(
      join(site, "public/schema/coffeejson-1.0.schema.json"),
      schemaBytes,
    );
    const authoringBytes = readFileSync(
      join(repo, "docs/schema/coffeejson-1.0.authoring.schema.json"),
    );
    writeFileSync(join(site, "public/schema/authoring/1.0"), authoringBytes);
    writeFileSync(
      join(site, "public/schema/coffeejson-1.0.authoring.schema.json"),
      authoringBytes,
    );
    console.log(
      "gen: schema → public/schema/1.0 + /schema/authoring/1.0 (+ aliases)",
    );

    // Every schema must resolve at the address it claims: a `$id` beneath a path
    // that is itself a file can never exist, and one that 404s invites a consumer
    // to fetch a URL that will never answer.
    for (const { $id: id } of [runtimeSchema, authoringSchema]) {
      if (!id?.startsWith(`${SITE_URL}/`))
        die(`$id ${id} is not on ${SITE_URL}`);
      const served = join(site, "public", id.slice(SITE_URL.length));
      if (!existsSync(served))
        die(`$id ${id} does not resolve — nothing served at ${served}`);
    }
    console.log("gen: verified both schemas resolve at their $id");

    // REPLACED, not written over: a slug that stops existing leaves a directory
    // vite discovers as an MPA input, publishing a page for a document the corpus
    // no longer has. Only directories go; each hand-written hub is tracked.
    const sweepGenerated = (dir) => {
      if (!existsSync(join(site, dir))) return [];
      const gone = readdirSync(join(site, dir), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
      for (const name of gone)
        rmSync(join(site, dir, name), { recursive: true, force: true });
      return gone;
    };
    sweepGenerated("recipes");
    sweepGenerated("beans");

    // One page per corpus document, written into the source tree because vite's
    // MPA input needs real files. Gitignored — `pnpm gen` is their only author.
    const pages = buildCorpusPages();
    for (const p of pages) {
      mkdirSync(join(site, "recipes", p.slug), { recursive: true });
      writeFileSync(join(site, "recipes", p.slug, "index.html"), p.html);
    }
    console.log(
      `gen: corpus pages — ${pages.length} documents → /recipes/<slug>/`,
    );

    // Written into the source tree like the corpus pages, and for the same reason.
    const beanPages = buildBeanPages(beans);
    for (const p of beanPages) {
      mkdirSync(join(site, "beans", p.slug), { recursive: true });
      writeFileSync(join(site, "beans", p.slug, "index.html"), p.html);
    }
    console.log(
      `gen: bean pages — ${beanPages.length} identities → /beans/<slug>/`,
    );

    const all = allIndexableUrls(index, beans);
    writeFileSync(join(site, "public/sitemap.xml"), buildSitemap(all));
    console.log(
      `gen: sitemap.xml — ${all.length} URLs ` +
        `(${INDEXABLE_PATHS.length} hand-written + ${corpusPageSlugs(index).length} corpus ` +
        `+ ${beanPages.length} bean)`,
    );

    // The curated data behind 06-vocabularies' open registries, served from the
    // canonical host so adopters sync the same slugs the seed tables illustrate.
    mkdirSync(join(site, "public/registries"), { recursive: true });
    for (const f of [
      "gear.json",
      "varietals.json",
      "addition-types.json",
      "producer-roles.json",
      "implementations.json",
    ])
      writeFileSync(
        join(site, "public/registries", f),
        readFileSync(join(repo, "registries", f)),
      );
    console.log(
      "gen: registries → public/registries/ (gear, varietals, addition types, producer roles, implementations)",
    );

    // Pages publishes apps/site/dist, so the repo's docs/ is NOT reachable at the
    // canonical host without this copy — and llms.txt links straight at these paths.
    for (const path of SERVED_MD) {
      const dest = join(site, "public", path);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(
        dest,
        rewriteDocLinks(readFileSync(join(repo, path), "utf8"), path),
      );
    }
    console.log(
      `gen: spec markdown → public/docs/ (${SERVED_MD.length} files, links rewritten for the site root)`,
    );

    // llms.txt + llms-full.txt — both derived, so neither can go stale against the spec.
    writeFileSync(join(site, "public/llms.txt"), buildLlmsTxt());
    const full = buildLlmsFullTxt();
    writeFileSync(join(site, "public/llms-full.txt"), full);
    console.log(
      `gen: llms.txt + llms-full.txt (${Math.round(full.length / 1024)} KB)`,
    );

    // `/agents.md` — the same guide `/agents/` renders, for an agent that fetches
    // rather than renders. Derived for the reason above: two hand-kept copies of
    // one guide diverge, and the copy that drifts is the one nobody looks at.
    writeFileSync(join(site, "public/agents.md"), buildAgentsMd());
    console.log("gen: agents.md → public/agents.md");

    // Demo QR — Tetsu Kasuya 4:6, the full scan → render → brew-along path.
    const QRCode = (await import("qrcode")).default;
    const tetsu = index.find((e) => e.slug === "tetsu-kasuya-4-6-basic");
    if (!tetsu) die("demo QR: tetsu-kasuya-4-6-basic missing from the corpus");
    const demoUrl = `${SITE_URL}${SHARE_PATH}${tetsu.payload}`;
    if (demoUrl.length > 2500)
      die(`demo QR URL is ${demoUrl.length} bytes — trim the document`);
    mkdirSync(join(site, "public/demo"), { recursive: true });
    writeFileSync(
      join(site, "public/demo/tetsu-kasuya-4-6.svg"),
      await QRCode.toString(demoUrl, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 2,
      }),
    );
    await QRCode.toFile(
      join(site, "public/demo/tetsu-kasuya-4-6.png"),
      demoUrl,
      { errorCorrectionLevel: "M", margin: 2, width: 640 },
    );
    console.log(`gen: demo QR (${demoUrl.length}-byte URL) → public/demo/`);
  })();
}
