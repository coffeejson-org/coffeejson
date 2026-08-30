import { describe, expect, it, test } from "vitest";
import {
  SITE_URL, allIndexableUrls, buildCorpusPage, buildCorpusPages, buildIndex, buildSitemap,
  corpusPageMeta, corpusPagePath, corpusPageSlugs,
} from "../tools/gen.mjs";

const index = buildIndex();
const pages = buildCorpusPages();
const bySlug = new Map(pages.map((p) => [p.slug, p]));

// One page per DOCUMENT — deliberately not one per recipe. `buildIndex` returns
// a card per recipe, so the two counts differ, and that difference is the whole
// shape decision these pages rest on.
test("there is exactly one page per corpus document, not per recipe", () => {
  expect(pages.length).toBe(new Set(index.map((e) => e.slug)).size);
  expect(pages.length).toBeLessThan(index.length); // multi-recipe documents exist
  expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length);
});

test("every card's document has a page, and every page has at least one card", () => {
  const carded = new Set(index.map((e) => e.slug));
  for (const slug of carded) expect(bySlug.has(slug), `${slug} has no page`).toBe(true);
  for (const p of pages) expect(carded.has(p.slug), `${p.slug} has no card`).toBe(true);
});

describe("head furniture", () => {
  it("every page declares its own canonical", () => {
    for (const p of pages) {
      expect(p.html, p.slug)
        .toContain(`<link rel="canonical" href="${SITE_URL}${corpusPagePath(p.slug)}" />`);
    }
  });

  it("gives every page a distinct title and description", () => {
    const grab = (s: string, re: RegExp) => (re.exec(s) ?? [])[1];
    const titles = pages.map((p) => grab(p.html, /<title>([^<]+)<\/title>/));
    const descs = pages.map((p) => grab(p.html, /<meta name="description" content="([^"]+)"/));
    expect(titles.every(Boolean)).toBe(true);
    expect(descs.every(Boolean)).toBe(true);
    expect(new Set(titles).size).toBe(pages.length);
    expect(new Set(descs).size).toBe(pages.length);
  });

  it("keeps descriptions inside what a result page shows", () => {
    for (const p of pages) {
      const d = (/<meta name="description" content="([^"]+)"/.exec(p.html) ?? [])[1]!;
      expect(d.length, p.slug).toBeLessThanOrEqual(160);
      // Clauses are dropped whole rather than cut, so nothing trails off.
      expect(d, p.slug).not.toMatch(/[…]|\.\.\.$/);
    }
  });

  it("never renders a JavaScript accident into user-visible text", () => {
    for (const p of pages) expect(p.html, p.slug).not.toMatch(/undefined|NaN/);
  });
});

describe("structured data", () => {
  it("every page carries Recipe JSON-LD naming the page's own URL", () => {
    for (const p of pages) {
      const ld = (/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(p.html) ?? [])[1]!;
      expect(ld, p.slug).toBeTruthy();
      const parsed = JSON.parse(ld.replace(/\\u003c/g, "<"));
      const recipes = Array.isArray(parsed) ? parsed : [parsed];
      const page = `${SITE_URL}${corpusPagePath(p.slug)}`;
      for (const r of recipes) {
        expect(r["@type"], p.slug).toBe("Recipe");
        // A url the page can actually be reached at. Naming the `?d=` share
        // link instead would point structured data at a robots-disallowed
        // address. Multi-recipe documents anchor within their page.
        expect(String(r.url).startsWith(page), `${p.slug}: ${r.url}`).toBe(true);
        expect(String(r.url), p.slug).not.toContain("?d=");
      }
    }
  });

  it("escapes the closing-tag sequence so no string can break out of the script", () => {
    for (const p of pages) {
      const ld = (/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(p.html) ?? [])[1]!;
      expect(ld, p.slug).not.toContain("<");
    }
  });
});

describe("multi-recipe documents", () => {
  const multi = pages.filter((p) => index.filter((e) => e.slug === p.slug).length > 1);

  it("exist — otherwise the anchor behavior below is untested", () => {
    expect(multi.length).toBeGreaterThan(0);
  });

  it("anchor each recipe and title themselves for the subject", () => {
    for (const p of multi) {
      const n = index.filter((e) => e.slug === p.slug).length;
      for (let i = 1; i <= n; i++) expect(p.html, `${p.slug} #${i}`).toContain(`id="recipe-${i}"`);
      // The title names the subject, not whichever recipe was authored first.
      expect(p.html, p.slug).toMatch(/<title>.* — \d+ brew methods — CoffeeJSON<\/title>/);
    }
  });
});

describe("the sitemap", () => {
  const xml = buildSitemap(allIndexableUrls(index));

  it("advertises every corpus page", () => {
    for (const slug of corpusPageSlugs(index)) {
      expect(xml).toContain(`<loc>${SITE_URL}${corpusPagePath(slug)}</loc>`);
    }
  });

  it("counts the hand-written pages plus one per document", () => {
    expect((xml.match(/<loc>/g) ?? []).length).toBe(allIndexableUrls(index).length);
  });
});

test("the page carries its documents inline, so it needs no index fetch", () => {
  for (const p of pages) {
    const payloads = [...p.html.matchAll(/data-payload="([^"]+)"/g)].map((m) => m[1]!);
    const cards = index.filter((e) => e.slug === p.slug);
    // One slot for the publication; on a multi-recipe page, one more per brew.
    expect(payloads.length, p.slug).toBe(cards.length > 1 ? cards.length + 1 : 1);
    for (const payload of payloads) {
      const doc = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      expect(doc.coffeejson, p.slug).toBeTruthy();
    }
  }
});

test("the page-level share hands over the WHOLE publication, not its first recipe", () => {
  // The trap this pins: card payloads are scoped projections, so reading one of
  // them here would make a three-brew page share only its first recipe.
  for (const p of pages) {
    const cards = index.filter((e) => e.slug === p.slug);
    if (cards.length < 2) continue;
    const pageSlot = /data-share-slot data-payload="([^"]+)"[^>]*data-slug="[^"]*"(?![^>]*data-i=)/
      .exec(p.html);
    expect(pageSlot, p.slug).toBeTruthy();
    const doc = JSON.parse(Buffer.from(pageSlot![1]!, "base64url").toString("utf8"));
    expect(doc.recipes, p.slug).toHaveLength(cards.length);
  }
});

test("each brew section on a multi-recipe page shares only that brew", () => {
  for (const p of pages) {
    const cards = index.filter((e) => e.slug === p.slug);
    if (cards.length < 2) continue;
    const scoped = [...p.html.matchAll(/data-payload="([^"]+)"[^>]*data-i="(\d+)"/g)];
    expect(scoped.length, p.slug).toBe(cards.length);
    for (const [, payload, i] of scoped) {
      const doc = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
      expect(doc.recipes, `${p.slug} #${i}`).toHaveLength(1);
      expect(doc.recipes[0].title, `${p.slug} #${i}`).toBe(cards[Number(i) - 1]!.title);
    }
  }
});

test("the content is in the HTML, not left for the island to render", () => {
  // The reason these pages are generated at all: a crawler that runs no JS must
  // still see the recipe. If this ever regresses to a hydration shell, the
  // pages stop doing the one job they exist for.
  for (const p of pages) {
    const body = (/<main[^>]*>(.*)<\/main>/s.exec(p.html) ?? [])[1]!;
    expect(body, p.slug).toContain("<h1>");
    expect(body, p.slug).toContain("attribution");
    expect(body.length, p.slug).toBeGreaterThan(600);
  }
});

test("a document with steps renders them as text", () => {
  const withSteps = index.find((e) => e.stepCount > 0)!;
  const html = bySlug.get(withSteps.slug)!.html;
  expect(html).toContain('<ol class="steps">');
});

describe("corpusPageMeta", () => {
  it("titles a single-recipe document with its recipe", () => {
    const { title } = corpusPageMeta(
      { slug: "x", attribution: { source_label: "A source", transcribed: "2026-01-01" } },
      { coffeejson: "1.0", recipes: [{ title: "One Cup", author: { name: "A" }, method: "pour_over" }] },
    );
    expect(title).toBe("One Cup — CoffeeJSON");
  });

  it("titles a multi-recipe document for its subject, not its first recipe", () => {
    const { title } = corpusPageMeta(
      { slug: "x", attribution: { source_label: "Roaster page", transcribed: "2026-01-01" } },
      {
        coffeejson: "1.0",
        beans: [{ name: "Sermon", roaster: { name: "Verve" } }],
        recipes: [
          { title: "Sermon Dwell", author: { name: "A" }, method: "pour_over" },
          { title: "Sermon French Press", author: { name: "A" }, method: "french_press" },
        ],
      },
    );
    expect(title).toBe("Verve Sermon — 2 brew methods — CoffeeJSON");
  });

  it("falls back to the source label when a multi-recipe document has no bean", () => {
    const { title } = corpusPageMeta(
      { slug: "x", attribution: { source_label: "Linea Caffe — Brew Guides", transcribed: "2026-01-01" } },
      {
        coffeejson: "1.0",
        recipes: [
          { title: "Chemex", author: { name: "A" }, method: "pour_over" },
          { title: "Drip", author: { name: "A" }, method: "drip" },
        ],
      },
    );
    expect(title).toBe("Linea Caffe — Brew Guides — 2 brew methods — CoffeeJSON");
  });
});

// The facts line reads the projection, so a grind size travels through
// `normalize` rather than around it, and labels through the vocabulary.
test("buildCorpusPage renders the grind size the projection carries", () => {
  const page = (size: unknown) => buildCorpusPage(
    { slug: "x", attribution: { source_label: "S", transcribed: "2026-01-01" } },
    { coffeejson: "1.0", recipes: [{
      title: "T", author: { name: "A" }, method: "pour_over",
      based_on: "https://example.test/x", grind: { size },
    }] },
  );
  expect(page("medium_coarse")).toContain("Medium-coarse grind");
  expect(page("clicky")).not.toMatch(/clicky| grind/);
});

test("buildCorpusPage escapes markup in a document's own strings", () => {
  const html = buildCorpusPage(
    { slug: "x", attribution: { source_label: "<script>alert(1)</script>", transcribed: "2026-01-01" } },
    {
      coffeejson: "1.0",
      recipes: [{
        title: 'Quote " and <b>tag</b>', author: { name: "A & B" }, method: "pour_over",
        based_on: "https://example.test/x",
      }],
    },
  );
  expect(html).not.toContain("<script>alert(1)</script>");
  expect(html).toContain("&lt;b&gt;tag&lt;/b&gt;");
  expect(html).toContain("A &amp; B");
});
