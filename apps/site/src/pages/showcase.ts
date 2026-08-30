import registry from "../../../../registries/implementations.json";
import { LICENSE_SITE, PACKAGES, footerHtml } from "../lib/footer.mjs";
import { esc } from "../lib/text.mjs";
import { siteHeader } from "../lib/site-header.mjs";

// WHERE CoffeeJSON can be used; `/implementations` is HOW to implement it, and the
// two must not drift into each other. A surface is listed as WORKING only where
// something already does it, and every card says which — a site demonstrating one
// is a weaker claim than a roaster shipping one, and must not read stronger.

const REPO = "https://github.com/coffeejson-org/coffeejson";
const GUIDE = `${REPO}/blob/main/docs/integration-guide.md`;
const TRANSPORT = `${REPO}/blob/main/docs/transport.md`;
const ISSUES = `${REPO}/issues`;

const PLATFORM: Record<string, string> = {
  ios: "iOS", watchos: "watchOS", macos: "macOS", android: "Android",
  web: "Web", windows: "Windows", linux: "Linux",
};
const SURFACE: Record<string, string> = {
  "query-binding": "share links",
  "coffeejson-file": "document files",
};
const label = (map: Record<string, string>, v: string) => map[v] ?? v;
const joined = (v: string[]) => v.map((x) => esc(label(SURFACE, x))).join(" and ");

// Either role may be empty — a site that only publishes documents reads nothing
// and is still an implementation — so the sentence takes whichever halves are true.
const does = (i: { reads: string[]; writes: string[] }) => {
  const parts = [];
  if (i.reads.length) parts.push(`opens ${joined(i.reads)}`);
  if (i.writes.length) parts.push(`publishes ${joined(i.writes)}`);
  const s = parts.join(", and ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// The JSON import types `icon` from the one entry that has it, so the card takes
// the shape the registry's `$comment` promises rather than today's file. The alt is
// empty because the name is the next thing in the row.
type Impl = { name: string; url: string; platforms: string[]; reads: string[]; writes: string[]; icon?: string };

const implCard = (i: Impl) => `
  <li class="card">
    <div class="card-head">
      ${i.icon ? `<img class="card-icon" src="${esc(i.icon)}" alt="" width="56" height="56" loading="lazy">` : ""}
      <div>
        <h3><a href="${esc(i.url)}" rel="noopener">${esc(i.name)}</a></h3>
        <p class="muted">${i.platforms.map((p) => esc(label(PLATFORM, p))).join(" · ")}</p>
      </div>
    </div>
    <p>${does(i)}.</p>
  </li>`;

// No per-card status line: five copies of one fact make the grid read as a
// progress report. It is said once, in prose, under the grid.
const SURFACES: { title: string; body: string }[] = [
  {
    title: "Between two apps",
    body: `Someone leaves your app with two years of brews and comes back later with
      more. You write one importer instead of one per vendor whose share codes you
      reverse-engineered yourself.`,
  },
  {
    title: "On a bag of coffee",
    body: `Print a QR on the bag. Your customer scans it in their kitchen and their
      phone walks them through your method — your dose, your grind, your pours. No app
      to build, no account for them to make, no link that expires.`,
  },
  {
    title: "In a link",
    body: `Paste a recipe into a message and it arrives whole. The document rides
      inside the URL, so nothing is stored and nothing is looked up — and it still opens
      after whoever hosted it is gone.`,
  },
  {
    title: "On a web page",
    body: `Publish your method as data instead of a picture of a table. A reader can
      send it straight to their timer, and it exports to schema.org <code>Recipe</code>,
      so search engines read the actual steps.`,
  },
  {
    title: "In files you keep",
    body: `Your brew log is plain <code>.json</code> on your own disk. When an app shuts
      down or changes its pricing, you already have everything — no export deadline,
      nothing to rescue.`,
  },
];

const surfaceCard = (s: (typeof SURFACES)[number]) => `
  <li class="card">
    <h3>${esc(s.title)}</h3>
    <p>${s.body}</p>
  </li>`;

/** The showcase body. Prerendered — see the note on `landingBody`. */
export const showcaseBody = (): string => `
  ${siteHeader("/showcase/")}

  <h1>Where CoffeeJSON fits</h1>
  <p class="lede">One document — a title, a dose, a pour schedule, the bean. Here is what
  it does once you have it.</p>

  <ul class="cards">${SURFACES.map(surfaceCard).join("")}</ul>
  <p class="muted">Four of these run on this site today. The bag is the one nobody has
  shipped — its <a href="${TRANSPORT}" rel="noopener">transport</a> is specified and
  working.</p>

  <h2 class="pull">What has shipped</h2>
  <ul class="cards cards--few">${registry.implementations.map(implCard).join("")}</ul>
  <p class="muted">The first implementer, and so far the only one. Shipped it?
  <a href="/implementations/">Add yourself to the registry</a> — no approval step.</p>

  <h2 class="pull">Implementing it</h2>
  <p>More implementations are the whole point, and there is help getting there:
  <strong>ask, and the importer and exporter get written for you</strong> — tested, with
  an example, yours under Apache-2.0 either way. Feedback counts as much as adoption:
  tell us what the format gets wrong and it changes.</p>
  <div class="row">
    <a class="btn" href="/implementations/">See how to implement it</a>
    <a class="btn btn--ghost" href="${ISSUES}" rel="noopener">Ask for an integration</a>
  </div>

  <nav class="row" aria-label="Related">
    <a href="/implementations/">How to implement</a>
    <a href="${GUIDE}" rel="noopener">Integration guide</a>
    <a href="/">What CoffeeJSON is</a>
  </nav>

  ${footerHtml(LICENSE_SITE, PACKAGES)}`;
