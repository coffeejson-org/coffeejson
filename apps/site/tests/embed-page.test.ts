import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePayload, normalize } from "@coffeejson/core";
import QRCode from "qrcode";
import { expect, test } from "vitest";
import documents from "../src/generated/embed-documents.json";
import { elementScriptUrl } from "../src/lib/element-url.mjs";
import {
  DEFAULT_SLUG,
  ELEMENT_VERSION,
  embedBody,
  USE_CASE_SLUGS,
} from "../src/pages/embed";
import { ELEMENT_SLOT, fillElement } from "../tools/element-script";

const site = fileURLToPath(new URL("..", import.meta.url));
const core = JSON.parse(
  readFileSync(join(site, "../../packages/core/package.json"), "utf8"),
);
const shell = readFileSync(join(site, "embed/index.html"), "utf8");
const body = embedBody();
const kinds = (slug: string) => {
  const found = documents.find((d) => d.slug === slug);
  if (!found) throw new Error(`no corpus document ${slug}`);
  const decoded = decodePayload(found.payload);
  if (!decoded.ok) throw new Error(`${slug} does not decode`);
  const { beans, recipes } = normalize(decoded.document);
  return { beans: beans.length, recipes: recipes.length };
};

test("the pinned version is core's own", () => {
  expect(ELEMENT_VERSION).toBe(core.version);
});

test("a build fills the shell with the CDN script at that version, once", () => {
  const built = fillElement(shell, "embed/index.html", false);
  const tags = [
    ...built.matchAll(/<script type="module" src="(https:[^"]+)"><\/script>/g),
  ];
  expect(tags.map((m) => m[1])).toEqual([elementScriptUrl(core.version)]);
  expect(elementScriptUrl(core.version)).toBe(
    `https://cdn.jsdelivr.net/npm/@coffeejson/core@${core.version}/dist/element/auto.js`,
  );
  expect(built).not.toContain("/@fs");
});

test("only the dev server swaps in the workspace build", () => {
  const served = fillElement(shell, "embed/index.html", true);
  expect(served).toMatch(
    /src="\/@fs\/[^"]+\/packages\/core\/dist\/element\/auto\.js"/,
  );
  expect(served).not.toContain("cdn.jsdelivr.net/npm/@coffeejson/core@");
});

test("a shell that lost its slot fails the build", () => {
  expect(() =>
    fillElement(shell.replace(ELEMENT_SLOT, ""), "embed/index.html", false),
  ).toThrow();
  expect(fillElement("<html></html>", "showcase/index.html", false)).toBe(
    "<html></html>",
  );
});

// `defineCoffeeJson` returns quietly when the tag is taken. A bundled copy that
// registered first would draw every card from this repo's build, and the page
// would stop testing the CDN without looking any different.
test("no site module imports the element", () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|mjs)$/.test(name)) files.push(p);
    }
  };
  walk(join(site, "src"));
  for (const f of files)
    expect(readFileSync(f, "utf8"), f).not.toMatch(
      /@coffeejson\/core\/element/,
    );
});

test("the default and the use cases are the documents their rows describe", () => {
  expect(kinds(DEFAULT_SLUG)).toMatchObject({ beans: 1 });
  expect(kinds(DEFAULT_SLUG).recipes).toBeGreaterThan(0);
  expect(kinds(USE_CASE_SLUGS.roaster)).toMatchObject({ beans: 1 });
  expect(kinds(USE_CASE_SLUGS.roaster).recipes).toBeGreaterThan(0);
  expect(kinds(USE_CASE_SLUGS.blog)).toEqual({ beans: 0, recipes: 1 });
});

test("the picker offers every corpus document, with the default selected", () => {
  const options = [...body.matchAll(/<option value="([^"]+)"( selected)?>/g)];
  expect(options.map((m) => m[1]).sort()).toEqual(
    documents.map((d) => d.slug).sort(),
  );
  expect(options.filter((m) => m[2]).map((m) => m[1])).toEqual([DEFAULT_SLUG]);
});

test("three cards are live; the script-stripping row keeps a link and its QR", () => {
  expect(body.match(/<coffee-json /g)).toHaveLength(3);
  expect(body).not.toMatch(/<coffee-json [^>]*jsonld/);
  const stripped = documents.find((d) => d.slug === USE_CASE_SLUGS.stripped)!;
  const link = `https://coffeejson.org/r/?d=${stripped.payload}`;
  expect(body).toContain(`<a href="${link}">`);
  const { modules } = QRCode.create(link, { errorCorrectionLevel: "M" });
  expect(body).toContain(
    `viewBox="-2 -2 ${modules.size + 4} ${modules.size + 4}"`,
  );
});

test("the attribute table is on the page", () => {
  expect(body).toContain(
    '<th scope="row" data-label="Attribute"><code>viewer-label</code></th>',
  );
});

test("the page tells a visitor how to use it and where to make their own", () => {
  expect(body).toMatch(
    /<ol class="embed-steps">[\s\S]*<a href="\/generate\/">build your own<\/a>/,
  );
  expect(body).toContain(
    '<a class="btn btn--lg" href="/generate/">Make a card for your coffee</a>',
  );
});

test("the page says it is a demonstration and points to what has shipped", () => {
  expect(body).toContain(
    "This\n  site is demonstrating the element, not listing who uses it",
  );
  expect(body).toContain('<a href="/showcase/">the showcase</a>');
  expect(body).not.toMatch(/\byet\b|used by/i);
});

test("with no script at all, every card still holds a link to its document", () => {
  const cards = [
    ...body.matchAll(
      /<coffee-json d="([^"]+)"[^>]*>([\s\S]*?)<\/coffee-json>/g,
    ),
  ];
  expect(cards).toHaveLength(3);
  for (const [, d, inner] of cards)
    expect(inner).toMatch(
      new RegExp(`^<a href="/r/\\?d=${d}">[^<]+, as CoffeeJSON</a>$`),
    );
});

// The label is a flex row, so its words must be one item: loose text and a
// <code> beside it become two columns, and "<head>" moves to the far edge.
test("the jsonld checkbox's words stay one sentence beside the box", () => {
  expect(body).toMatch(
    /<label class="embed-check"><input [^>]+>\s*<span>Add schema\.org data to the page's <code>&lt;head&gt;<\/code><\/span><\/label>/,
  );
});
