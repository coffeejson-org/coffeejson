import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  allIndexableUrls,
  buildSitemap,
  INDEXABLE_PATHS,
  lastCommitTimes,
  lastmodOf,
  PAGE_SOURCES,
  pageSources,
  parseGitLog,
  SITE_URL,
  sitemapLastmods,
} from "../tools/gen.mjs";

const repo = fileURLToPath(new URL("../../..", import.meta.url));

// Newest commit first, as `git log` prints it. Times are in Unix seconds.
const LOG = [
  "@1788998400", // 2026-09-10
  "recipes/b.json",
  "",
  "@1788220800", // 2026-09-01
  "recipes/a.json",
  "recipes-archive/a.json",
  "",
  "@1787011200", // 2026-08-18
  "recipes/a.json",
  "apps/site/src/pages/showcase.ts",
].join("\n");

describe("a page's lastmod", () => {
  const times = parseGitLog(LOG);

  it("is the newest commit to any of its sources", () => {
    expect(lastmodOf(["recipes/a.json"], times)).toBe("2026-09-01");
    expect(lastmodOf(["recipes/a.json", "recipes/b.json"], times)).toBe(
      "2026-09-10",
    );
  });

  it("reads a directory as everything under it, and nothing beside it", () => {
    expect(lastmodOf(["recipes"], times)).toBe("2026-09-10");
    expect(lastmodOf(["recipes-archive"], times)).toBe("2026-09-01");
    expect(lastmodOf(["recipe"], times)).toBeUndefined();
  });

  it("is absent when history has no date for its sources", () => {
    expect(lastmodOf(["registries/gear.json"], times)).toBeUndefined();
  });
});

describe("the sitemap's lastmod", () => {
  afterEach(() => vi.useRealTimers());

  it("is written per URL, and omitted where there is no date", () => {
    const xml = buildSitemap(
      ["https://x.test/a/", "https://x.test/b/"],
      new Map([["https://x.test/a/", "2026-09-01"]]),
    );
    expect(xml).toContain(
      "<url><loc>https://x.test/a/</loc><lastmod>2026-09-01</lastmod></url>",
    );
    expect(xml).toContain("<url><loc>https://x.test/b/</loc></url>");
  });

  it("is never the build time", () => {
    // The clock moves, but the dates do not: they come from git history only.
    const sources = new Map([["https://x.test/", ["recipes"]]]);
    const before = sitemapLastmods(sources, parseGitLog(LOG));
    vi.useFakeTimers({ now: new Date("2099-01-01T00:00:00Z") });
    expect(sitemapLastmods(sources, parseGitLog(LOG))).toEqual(before);
    expect(before.get("https://x.test/")).toBe("2026-09-10");
  });

  it("is omitted entirely without history", () => {
    expect(sitemapLastmods(pageSources(), null).size).toBe(0);
  });
});

describe("page sources", () => {
  it("name every hand-written page, and only those", () => {
    expect(Object.keys(PAGE_SOURCES).sort()).toEqual(
      [...INDEXABLE_PATHS].sort(),
    );
  });

  it("cover every URL the sitemap advertises, with paths that exist", () => {
    const sources = pageSources();
    expect([...sources.keys()].sort()).toEqual(allIndexableUrls().sort());
    for (const [url, paths] of sources) {
      expect(paths.length, url).toBeGreaterThan(0);
      for (const p of paths) expect(existsSync(join(repo, p)), p).toBe(true);
    }
  });

  // A shallow clone gives no dates, so the build omits every lastmod. Both
  // workflows that build the site fetch full history.
  const times = lastCommitTimes();
  it.skipIf(times === null)(
    "date every hand-written page from this checkout's history",
    () => {
      // Corpus pages are excluded. An uncommitted transcription has no date yet.
      const lastmods = sitemapLastmods(pageSources(), times);
      for (const path of INDEXABLE_PATHS)
        expect(lastmods.get(`${SITE_URL}${path}`), path).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
    },
  );

  it.each([
    [".github/workflows/deploy-pages.yml"],
    [".github/workflows/validate.yml"],
  ])("%s checks out full history", (file) => {
    expect(readFileSync(join(repo, file), "utf8")).toMatch(/fetch-depth: 0/);
  });
});
