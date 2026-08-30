import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GITHUB_BLOB, SERVED_MD, SITE_URL } from "../tools/gen.mjs";

// The served doc copies are read at the site root, where a relative link escapes
// into paths the site never serves. gen.mjs rewrites every relative target to an
// absolute URL; a link that survives rewriting relative is a 404 that GitHub
// rendering would never show.

const site = fileURLToPath(new URL("..", import.meta.url));
const pub = (p: string) => join(site, "public", p);

/** Every markdown link target in `text`, minus fenced code blocks. */
function linkTargets(text: string): string[] {
  const withoutFences = text.replace(/```[\s\S]*?```/g, "");
  return [...withoutFences.matchAll(/\]\(([^)]+)\)/g)]
    .map((m) => (m[1] ?? "").split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

/** A site-URL target must exist in the served tree (fragment stripped). */
function servedPathFor(url: string): string | null {
  const path = url.slice(SITE_URL.length).replace(/#.*$/, "");
  if (path === "" || path === "/") return "index.html";
  if (path === "/schema/1.0") return "schema/1.0";
  if (path === "/schema/authoring/1.0") return "schema/authoring/1.0";
  if (path === "/llms-full.txt") return "llms-full.txt";
  if (path.endsWith("/")) return `${path.slice(1)}index.html`;
  return path.slice(1);
}

const documents = [
  ...SERVED_MD.map((p: string) => ({ name: p, text: readFileSync(pub(p), "utf8") })),
  { name: "llms-full.txt", text: readFileSync(pub("llms-full.txt"), "utf8") },
];

describe("served docs carry no relative links", () => {
  for (const { name, text } of documents) {
    it(`${name} — every link is absolute or a fragment`, () => {
      for (const target of linkTargets(text)) {
        const ok = target.startsWith("#") || /^https?:\/\//.test(target) || /^mailto:/.test(target);
        expect(ok, `relative link survived rewriting: ${target} in ${name}`).toBe(true);
      }
    });

    it(`${name} — every site-URL link resolves in the served tree`, () => {
      for (const target of linkTargets(text)) {
        if (!target.startsWith(SITE_URL)) continue;
        const served = servedPathFor(target);
        if (served === null) continue;
        // Generated artifacts live under public/; the page HTML entry points
        // live at the site root (Vite multi-page inputs) and build into dist.
        const exists = existsSync(pub(served)) || existsSync(join(site, served));
        expect(exists, `${target} (→ ${served}) missing, linked from ${name}`).toBe(true);
      }
    });
  }

  it("the rewriter actually fired — unserved targets became blob URLs", () => {
    const all = documents.map((d) => d.text).join("\n");
    expect(all.includes(GITHUB_BLOB)).toBe(true);
  });
});
