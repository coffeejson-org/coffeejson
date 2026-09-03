import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { GITHUB_URL, NAV, siteHeader } from "../src/lib/site-header.mjs";

// Order is part of the nav, not an accident of it. Browse, Showcase and
// Implementations answer "what is this, and should I use it"; the two tools only
// matter once that is settled, so they sit after.
const NAV_ORDER = [
  "Browse",
  "Showcase",
  "Implementations",
  "Validator",
  "Generate",
  "GitHub",
];

// The headers that are themselves nav destinations. `/`, `/r/`, `/beans/` and
// `/agents/` have no nav entry: the agents page is agent-facing and
// `llms.txt` is its front door, so it stays out of a nav that is for humans —
// reopen only with a reason that survives that. `/implementations/` and
// `/showcase/` are in because both answer the question an evaluator opens the
// site with: "is any of this real?".
const labelsIn = (html: string): string[] =>
  [
    ...html.matchAll(
      />(Browse|Showcase|Implementations|Validator|Generate|GitHub)</g,
    ),
  ].map((m) => m[1]!);

test("the nav lists the same destinations in the same order, whichever page renders it", () => {
  for (const current of ["/", "/beans/", ...NAV.map(([href]) => href)])
    expect(labelsIn(siteHeader(current)), current).toEqual(NAV_ORDER);
});

test("the /recipes/ destination is labeled Browse, never Recipes", () => {
  // One URL serves two lenses, and the nav names the surface, not one of its
  // views. (The lens toggle inside the page does say Recipes — that IS a view.)
  expect(NAV).toContainEqual(["/recipes/", "Browse"]);
});

test("a page marks itself as current exactly when it has a nav entry", () => {
  for (const [href] of NAV) {
    const html = siteHeader(href);
    expect((html.match(/aria-current="page"/g) ?? []).length, href).toBe(1);
    // Its own entry stops being a link: a reader is already there.
    expect(html, href).not.toContain(`href="${href}"`);
  }
  for (const current of ["/", "/beans/", "/agents/", "/recipes/some-slug/"])
    expect(
      (siteHeader(current).match(/aria-current="page"/g) ?? []).length,
      current,
    ).toBe(0);
});

test("the wordmark links home everywhere but home", () => {
  expect(siteHeader("/")).toContain(
    '<header class="site-header"><strong>CoffeeJSON</strong>',
  );
  expect(siteHeader("/validator/")).toContain(
    '<a href="/"><strong>CoffeeJSON</strong></a>',
  );
});

test("every nav header offers GitHub", () => {
  expect(siteHeader("/")).toContain(GITHUB_URL);
});

// The masthead has one implementation; the two React surfaces build their JSX
// from the same list. This is what keeps a hand-written copy from appearing in a
// page module and looking fine everywhere the author checked.
const pagesDir = fileURLToPath(new URL("../src/pages", import.meta.url));
test("no page module hand-writes the masthead", () => {
  const handWritten = readdirSync(pagesDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .filter((f) =>
      /<header[^>]*site-header/.test(readFileSync(join(pagesDir, f), "utf8")),
    );
  // `r-shared` maps NAV into JSX; `r-brew` is the wordmark alone, because
  // mid-brew is not the moment to offer four ways to leave.
  expect(handWritten.sort()).toEqual(["r-brew.tsx", "r-shared.tsx"]);
});

test("the generator renders the masthead through the shared function", () => {
  const gen = readFileSync(
    fileURLToPath(new URL("../tools/gen.mjs", import.meta.url)),
    "utf8",
  );
  expect(gen).not.toMatch(/<header[^>]*site-header/);
  expect((gen.match(/siteHeader\(/g) ?? []).length).toBe(2);
});

// The mark is CSS rather than markup: a mask on the wordmark reaches every page,
// including the two React headers that do not render through `siteHeader`. That
// buys reach at the cost of the two failure modes below.
const styles = readFileSync(
  fileURLToPath(new URL("../src/styles.css", import.meta.url)),
  "utf8",
);

test("the header mark's mask asset exists", () => {
  // A missing mask does not degrade to "no mark": the pseudo-element paints its
  // background unmasked, putting a solid block next to the wordmark site-wide.
  const url = /\bmask:\s*url\((\/[^)\s]+)\)/.exec(styles)?.[1];
  if (!url) throw new Error("no mask url on .site-header strong::before");
  const asset = join(fileURLToPath(new URL("../public", import.meta.url)), url);
  expect(readFileSync(asset, "utf8")).toContain("<svg");
});

test("the wordmark is pinned to fg, not the link color", () => {
  // A bare <strong> on the landing page and an <a> everywhere else, so without an
  // explicit color it inherits `fg` on one page and `accent` on the rest — and the
  // mark paints in currentColor.
  expect(styles).toMatch(/\.site-header strong\s*\{[^}]*color:\s*var\(--fg\)/);
});
