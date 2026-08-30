import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INDEXABLE_PATHS, SITE_URL, buildSitemap, indexableUrls } from "../tools/gen.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const robots = readFileSync(join(site, "public/robots.txt"), "utf8");
const html = (p: string) => readFileSync(join(site, p), "utf8");

const PAGES: [string, string][] = [
  ["index.html", "/"],
  ["validator/index.html", "/validator/"],
  ["r/index.html", "/r/"],
  ["recipes/index.html", "/recipes/"],
  ["generate/index.html", "/generate/"],
  ["for-ai-agents/index.html", "/for-ai-agents/"],
];

// A minimal robots matcher for the `User-agent: *` group. Deliberately literal
// prefix matching, which is what the spec says Disallow does — the sibling
// site's outage came from *assuming* `/r` meant only `/r`, when as a prefix it
// also shadowed `/recipes`.
function disallowedForAll(path: string): boolean {
  const lines = robots.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l) => l.toLowerCase() === "user-agent: *");
  expect(start).toBeGreaterThanOrEqual(0);
  const rules: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^user-agent:/i.test(line)) break;
    const m = /^disallow:\s*(\S*)$/i.exec(line);
    if (m && m[1]) rules.push(m[1]);
  }
  return rules.some((r) => path.startsWith(r));
}

describe("robots.txt", () => {
  it("never blocks a URL the sitemap advertises", () => {
    for (const path of INDEXABLE_PATHS) {
      expect(disallowedForAll(path), `robots blocks sitemap URL ${path}`).toBe(false);
    }
  });

  it("keeps the unbounded ?d= payload space out, in both path shapes", () => {
    expect(disallowedForAll("/r?d=eyJ")).toBe(true);
    expect(disallowedForAll("/r/?d=eyJ")).toBe(true);
  });

  it("does not shadow /recipes while disallowing the payload space", () => {
    // The prefix trap: a bare `Disallow: /r` would take /recipes with it.
    expect(disallowedForAll("/recipes/")).toBe(false);
    expect(robots).not.toMatch(/^disallow:\s*\/r\s*$/im);
  });

  it("disallows the named training crawlers and no others", () => {
    for (const bot of ["GPTBot", "CCBot", "Bytespider", "Amazonbot", "Applebot-Extended", "meta-externalagent"]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    // Retrieval bots are allowed by omission — a group of their own would be a
    // block, since every named group here is a full `Disallow: /`.
    for (const bot of ["ClaudeBot", "Google-Extended", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot"]) {
      expect(robots).not.toContain(`User-agent: ${bot}`);
    }
  });

  it("carries the retrieval-only Content-Signal and points at the sitemap", () => {
    expect(robots).toContain("Content-Signal: search=yes,ai-input=yes,ai-train=no");
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it("states the policy is site access, not a license term", () => {
    // The artifacts are CC0: a crawler policy cannot add a condition to them,
    // and the AI-agents page must not imply it does.
    expect(robots).toMatch(/NOT a license term/i);
    expect(robots).toMatch(/CC0/);
  });
});

describe("sitemap.xml", () => {
  const xml = buildSitemap();

  it("lists every indexable URL, absolute and canonical", () => {
    for (const url of indexableUrls()) expect(xml).toContain(`<loc>${url}</loc>`);
    expect(xml.match(/<loc>/g) ?? []).toHaveLength(INDEXABLE_PATHS.length);
  });

  it("emits a well-formed urlset", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});

describe("JSON-LD urls", () => {
  // robots.txt disallows the `?d=` payload space and /r/ canonicalizes every
  // payload to bare /r/, so structured data naming a share link points at a
  // forbidden address. Checked at the source: the injection runs on page load.
  const callers = ["../src/pages", "../src/lib"].flatMap((d) => {
    const dir = fileURLToPath(new URL(d, import.meta.url));
    return readdirSync(dir)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);
  }).filter(([, src]) => src.includes("docJsonLd("));

  it("every module calling docJsonLd is accounted for", () => {
    // `jsonld.ts` declares it; the other two call it.
    expect(callers.map(([f]) => f).sort()).toEqual(["jsonld.ts", "r.tsx", "recipes-body.ts"]);
  });

  it.each([["r.tsx"], ["recipes-body.ts"]])("%s passes docJsonLd no url", (file) => {
    const src = callers.find(([f]) => f === file)![1];
    // A second argument is a declared url. Until a recipe has a page of its
    // own, no address here survives both robots.txt and the canonical.
    for (const call of src.match(/docJsonLd\([^)]*\)/g) ?? []) {
      expect(call, `${file}: ${call}`).not.toMatch(/,/);
    }
  });
});

describe("canonical URLs", () => {
  it.each(PAGES)("%s declares the canonical the sitemap uses", (file, path) => {
    expect(html(file)).toContain(`<link rel="canonical" href="${SITE_URL}${path}" />`);
  });

  it.each(PAGES)("%s declares a matching og:url", (file, path) => {
    expect(html(file)).toContain(`<meta property="og:url" content="${SITE_URL}${path}" />`);
  });

  it("gives every page a distinct title and description", () => {
    const grab = (s: string, re: RegExp) => (re.exec(s) ?? [])[1];
    const titles = PAGES.map(([f]) => grab(html(f), /<title>([^<]+)<\/title>/));
    const descs = PAGES.map(([f]) => grab(html(f), /<meta name="description" content="([^"]+)"/));
    expect(titles.every(Boolean)).toBe(true);
    expect(descs.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(PAGES.length);
    expect(new Set(descs).size).toBe(PAGES.length);
  });
});

describe("social preview", () => {
  // Without og:image every share of this site renders as a bare text link. These
  // also pin the declared dimensions to the ACTUAL file: a regenerated image at a
  // different size leaves the numbers lying, and no crawler will tell you.
  const OG = "og.png";
  const png = readFileSync(join(site, "public", OG));

  function pngSize(buf: Buffer): [number, number] {
    // IHDR is the first chunk; width and height are the two big-endian u32s
    // at byte 16. Signature check first so a JPEG swapped in fails loudly.
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }

  it("is a PNG at the size the pages declare", () => {
    expect(pngSize(png)).toEqual([1200, 630]);
  });

  it.each(PAGES)("%s declares an absolute og:image", (file) => {
    expect(html(file)).toContain(`<meta property="og:image" content="${SITE_URL}/${OG}" />`);
  });

  it.each(PAGES)("%s declares dimensions matching the file", (file) => {
    const [w, h] = pngSize(png);
    expect(html(file)).toContain(`<meta property="og:image:width" content="${w}" />`);
    expect(html(file)).toContain(`<meta property="og:image:height" content="${h}" />`);
  });

  it.each(PAGES)("%s opts into the large card", (file) => {
    expect(html(file)).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("generated corpus pages carry the same image", () => {
    const gen = readFileSync(join(site, "tools/gen.mjs"), "utf8");
    expect(gen).toContain('<meta property="og:image" content="${SITE_URL}/og.png" />');
    expect(gen).toContain('name="twitter:card" content="summary_large_image"');
  });
});
