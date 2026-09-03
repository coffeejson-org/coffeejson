import { expect, test } from "vitest";
import { agentsBody } from "../src/pages/agents";
import { implementationsBody } from "../src/pages/implementations";
import { landingBody } from "../src/pages/landing";
import { showcaseBody } from "../src/pages/showcase";
import { SERVED_MD } from "../tools/gen.mjs";

// The site serves the docs only as raw Markdown at their exact paths under
// /docs/ (the SERVED_MD set), never a directory index and never an .html copy.
// A prerendered page that links into /docs/ links one of those files exactly,
// or links the rendered copy on GitHub. The implementations page shipped
// `/docs/integration-guide.html` and `/docs/`, both 404s on the live site, and
// no test read the pages' own hrefs.
const pages: [string, () => string][] = [
  ["/", landingBody],
  ["/implementations/", implementationsBody],
  ["/showcase/", showcaseBody],
  ["/agents/", agentsBody],
];

const served = new Set(SERVED_MD.map((p: string) => `/${p}`));

test("every /docs href on a prerendered page names a file the site serves", () => {
  for (const [path, body] of pages) {
    const hrefs = [...body().matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
    const unserved = hrefs
      .filter((h) => h.startsWith("/docs"))
      .map((h) => h.replace(/#.*$/, ""))
      .filter((h) => !served.has(h));
    expect(unserved, path).toEqual([]);
  }
});
