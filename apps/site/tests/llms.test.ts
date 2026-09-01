import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INDEXABLE_PATHS, SITE_URL, SKILLS_LINKS, buildLlmsFullTxt, buildLlmsTxt } from "../tools/gen.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const llms = buildLlmsTxt();

/** Every `[title](url): description` target in the document. */
const links = [...llms.matchAll(/^- \[([^\]]+)\]\(([^)]+)\):/gm)].map((m) => ({
  title: m[1] ?? "",
  url: m[2] ?? "",
}));

describe("llms.txt", () => {
  it("follows the llmstxt.org shape: H1, blockquote summary, link sections", () => {
    const lines = llms.split("\n");
    expect(lines[0]).toBe("# CoffeeJSON");
    expect(lines[2]?.startsWith("> ")).toBe(true);
    expect(llms).toMatch(/^## Specification$/m);
    expect(llms).toMatch(/^## Machine-readable$/m);
  });

  it("links every spec chapter and guide", () => {
    expect(links.length).toBeGreaterThanOrEqual(13);
    for (const t of ["Overview", "Document envelope", "Recipe", "Bean", "Vocabularies & registries", "Versioning & conformance"]) {
      expect(links.map((l) => l.title)).toContain(t);
    }
  });

  // The failure this file exists to prevent. Pages publishes apps/site/dist, so
  // the repo's docs/ is not reachable at the canonical host unless gen copies it
  // in. A front door for machines that 404s is worse than no front door.
  it("has no dead links — every target is a file gen emits or a real page", () => {
    const dead: string[] = [];
    const offsite = new Set(SKILLS_LINKS.map(([, u]) => u));
    for (const { url } of links) {
      // The skills repository is the one resource that does not live here. It is
      // listed explicitly so a typo cannot smuggle another off-host link in.
      if (offsite.has(url)) continue;
      expect(url.startsWith(SITE_URL), `${url} is not on the canonical host`).toBe(true);
      const path = url.slice(SITE_URL.length);
      if (INDEXABLE_PATHS.includes(path)) continue;
      if (!existsSync(join(site, "public", path))) dead.push(path);
    }
    expect(dead, `dead llms.txt links (run \`pnpm gen\`): ${dead.join(", ")}`).toEqual([]);
  });

  it("states the CC0 license without implying conditions", () => {
    expect(llms).toMatch(/CC0/);
    expect(llms).toMatch(/no attribution required/i);
  });
});

describe("llms-full.txt", () => {
  const full = buildLlmsFullTxt();

  it("inlines every chapter's real content, not a link to it", () => {
    // Built from a stub reader so the assertion is about assembly, not prose.
    const stub = buildLlmsFullTxt((p) => `CONTENT-OF:${p}`);
    for (const path of [
      "docs/spec/01-overview.md",
      "docs/spec/07-versioning.md",
      "docs/transport.md",
      "docs/integration-guide.md",
    ]) {
      expect(stub).toContain(`CONTENT-OF:${path}`);
      expect(stub).toContain(`<!-- source: ${path} -->`);
    }
  });

  it("is substantial and carries the real spec text", () => {
    expect(full.length).toBeGreaterThan(50_000);
    expect(full).toContain("# CoffeeJSON — the complete specification");
  });

  it("matches what gen wrote to public/", () => {
    const onDisk = join(site, "public/llms-full.txt");
    if (!existsSync(onDisk)) return; // gen runs in pretest; skip if invoked standalone
    expect(readFileSync(onDisk, "utf8")).toBe(full);
  });
});
