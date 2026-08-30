import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { HEAD_JSONLD, PRERENDERED, SLOT, fill } from "../tools/prerender";
import { recipesBody } from "../src/lib/recipes-body";
import { filtersFromSearch } from "../src/lib/filter";

const site = fileURLToPath(new URL("..", import.meta.url));
const shell = (page: string) => readFileSync(site + page, "utf8");

// The failure this file exists for is silent: if a shell stops carrying the slot,
// injection no-ops, the page ships blank again, and nothing else notices — the
// browser still fills it, so every other test and every human passes.
test("every prerendered shell carries the slot the build fills", () => {
  for (const page of Object.keys(PRERENDERED)) expect(shell(page), page).toContain(SLOT);
});

test("filling a shell puts the page's own heading inside it", () => {
  for (const page of Object.keys(PRERENDERED)) {
    const filled = fill(shell(page), page);
    expect(filled, page).not.toContain(SLOT);
    expect(filled, `${page} has no <h1> after filling`).toMatch(/<main id="app">[\s\S]*<h1/);
    expect(filled.length, `${page} grew by nothing`).toBeGreaterThan(shell(page).length + 1000);
  }
});

test("a page with no body is passed through untouched", () => {
  // The validator is interactive from the first paint and is not prerendered.
  const untouched = shell("validator/index.html");
  expect(fill(untouched, "validator/index.html")).toBe(untouched);
});

test("a shell that lost its slot fails the build rather than shipping blank", () => {
  expect(() => fill("<html><body><main id=\"app\" data-x></main></body></html>", "index.html"))
    .toThrow();
});

test("a prerendered page loads no module that would rebuild what the build wrote", () => {
  // Two exceptions, and both say why in their own source: the bags hub re-renders
  // for `?roaster=`, the recipe directory for any filter in the URL.
  const HYDRATES: Record<string, string[]> = {
    "beans/index.html": ["beans"],
    "recipes/index.html": ["recipes"],
  };
  for (const page of Object.keys(PRERENDERED)) {
    const scripts = [...shell(page).matchAll(/src="\/src\/pages\/([\w-]+)\.ts"/g)].map((m) => m[1]);
    expect(scripts, page).toEqual(HYDRATES[page] ?? []);
  }
});

// The recipe directory is the only page whose module hydrates markup it did not
// write. If the two ever produce different HTML for the same filters, listeners
// attach to a DOM the module disagrees with — a page that looks right and
// misbehaves on the first click, which is worse than the blank page it replaced.
test("the recipe directory's build output is what its module would render", () => {
  const filled = fill(shell("recipes/index.html"), "recipes/index.html");
  const inMain = filled.slice(filled.indexOf('<main id="app">') + '<main id="app">'.length,
                              filled.lastIndexOf("</main>"));
  expect(inMain).toBe(recipesBody(filtersFromSearch("")));
});

test("the recipe directory carries BOTH its own identity and the corpus, in the static head", () => {
  const filled = fill(shell("recipes/index.html"), "recipes/index.html");
  const head = filled.slice(0, filled.indexOf("</head>"));
  const blocks = [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map((m) => JSON.parse(m[1]!.replace(/\\u003c/g, "<")))
    .flatMap((v) => (Array.isArray(v) ? v : [v]));

  // The hand-written Dataset says what this page IS; the generated Recipes say
  // what it holds. Both belong in the head, and neither replaces the other.
  expect(blocks.filter((o) => o["@type"] === "Dataset")).toHaveLength(1);
  const recipes = blocks.filter((o) => o["@type"] === "Recipe");
  expect(recipes).toHaveLength(HEAD_JSONLD["recipes/index.html"]!().length);
  expect(recipes.length).toBeGreaterThan(50);
});
