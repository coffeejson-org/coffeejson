import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  FOOTER_LINKS,
  LICENSE_SITE,
  SPEC_URL,
  siteFooter,
} from "../src/lib/footer.mjs";
import { GITHUB_URL } from "../src/lib/site-header.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(site, p), "utf8");

// One module builds this row. Two hand-written copies of it drifted before.
const FOOTER_ORDER = [
  "Home",
  "Browse",
  "Showcase",
  "Spec",
  "For AI agents",
  "GitHub",
];

const linksRow = (html: string): string =>
  /<footer class="site-footer"><nav[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? "";

test("the footer lists the same links in the same order", () => {
  expect(FOOTER_LINKS.map(([, label]) => label)).toEqual(FOOTER_ORDER);
  const labels = [...linksRow(siteFooter(LICENSE_SITE)).matchAll(/>([^<]+)</g)]
    .map((m) => m[1]!)
    .filter((t) => t.trim() !== "·");
  expect(labels).toEqual(FOOTER_ORDER);
});

test("every pair of footer links is separated by a dot", () => {
  const row = linksRow(siteFooter(LICENSE_SITE));
  expect(row.replace(/<a [^>]*>[^<]*<\/a>/g, "|")).toBe(
    Array(FOOTER_ORDER.length).fill("|").join(" · "),
  );
});

test("every on-site footer link is a page the site serves", () => {
  for (const [href] of FOOTER_LINKS.filter(([h]) => h.startsWith("/")))
    expect(existsSync(join(site, href, "index.html")), href).toBe(true);
});

test("Spec points where the home page does, and the home page uses it", () => {
  expect(SPEC_URL).toBe(`${GITHUB_URL}/tree/main/docs/spec`);
  expect(FOOTER_LINKS).toContainEqual([SPEC_URL, "Spec"]);
  expect(read("src/pages/landing.ts")).toContain(
    '<a href="${SPEC_URL}" rel="noopener">Specification</a>',
  );
});

test("the footer always carries the license line", () => {
  expect(siteFooter(LICENSE_SITE)).toContain(
    `<p class="muted">${LICENSE_SITE}`,
  );
});

// A page that writes its own links row fails this test.
test("no source module hand-writes the links footer", () => {
  const handWritten = ["src/pages", "src/lib"]
    .flatMap((d) => readdirSync(join(site, d)).map((f) => `${d}/${f}`))
    .concat("tools/gen.mjs")
    .filter((f) => /<footer class="site-footer"/.test(read(f)));
  expect(handWritten).toEqual(["src/lib/footer.mjs"]);
});
