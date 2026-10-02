// The masthead, once. `DESIGN.md` § Navigation fixes the destinations and their
// order; the page a reader is already on names itself instead of linking there,
// and the wordmark links home except at home.

export const GITHUB_URL = "https://github.com/coffeejson-org/coffeejson";

/** The nav destinations, in order. Browse, Showcase and Implementations answer
 *  "what is this, and should I use it"; the two tools only matter after that. */
export const NAV = [
  ["/recipes/", "Browse"],
  ["/showcase/", "Showcase"],
  ["/implementations/", "Implementations"],
  ["/validator/", "Validator"],
  ["/generate/", "Generate"],
];

/** `current` is the page's own href — "/" at home, and a path with no nav entry
 *  (a corpus page, `/beans/`) simply matches nothing. */
// A recipe page and a bag page sit under Browse without being it: the link
// stays a link and is marked as the section, not as the page.
const inSection = (href, current) =>
  href === "/recipes/" &&
  current !== href &&
  (current.startsWith("/recipes/") || current.startsWith("/beans/"));

export const siteHeader = (current) =>
  `<a class="skip" href="#content">Skip to content</a><header class="site-header">${
    current === "/"
      ? "<strong>CoffeeJSON</strong>"
      : '<a href="/"><strong>CoffeeJSON</strong></a>'
  }<nav class="site-nav" aria-label="Primary">${NAV.map(([href, label]) =>
    href === current
      ? `<span aria-current="page">${label}</span>`
      : `<a href="${href}"${inSection(href, current) ? ' aria-current="true"' : ""}>${label}</a>`,
  ).join(
    "",
  )}<a href="${GITHUB_URL}" rel="noopener">GitHub</a></nav></header><span id="content" tabindex="-1"></span>`;
