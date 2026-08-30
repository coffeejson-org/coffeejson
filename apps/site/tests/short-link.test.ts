import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SITE_URL } from "../tools/gen.mjs";
import { qrSvg } from "../src/lib/qr";
import { payloadForShortLink, shortLinkFromSearch, slugFromSearch } from "../src/lib/short-link";
import type { CorpusEntry, DocumentIndex } from "../src/lib/short-link";
import { failCopy } from "../src/pages/r-shared";

const site = fileURLToPath(new URL("..", import.meta.url));
const index = JSON.parse(
  readFileSync(join(site, "src/generated/recipes-index.json"), "utf8"),
) as CorpusEntry[];
const documents = JSON.parse(
  readFileSync(join(site, "src/generated/documents-index.json"), "utf8"),
) as DocumentIndex;

// /recipes cards QR the short `/r/?s=<slug>` form; `?d=` stays canonical.
describe("short corpus links", () => {
  it("reads the s slug from a search string, and only the s slug", () => {
    expect(slugFromSearch("?s=tetsu-kasuya-4-6-basic")).toBe("tetsu-kasuya-4-6-basic");
    expect(slugFromSearch("?d=eyJhIjoxfQ")).toBeNull();
    expect(slugFromSearch("?s=")).toBeNull();
    expect(slugFromSearch("")).toBeNull();
  });

  it("reads the 1-based i, and treats a malformed one as absent", () => {
    expect(shortLinkFromSearch("?s=x&i=2")).toEqual({ slug: "x", index: 2 });
    expect(shortLinkFromSearch("?s=x")).toEqual({ slug: "x", index: null });
    // A typo resolves the publication rather than 404ing something the site
    // can plainly serve.
    for (const bad of ["0", "-1", "abc", "1.5", ""]) {
      expect(shortLinkFromSearch(`?s=x&i=${bad}`), bad).toEqual({ slug: "x", index: null });
    }
    expect(shortLinkFromSearch("?i=2")).toBeNull();
  });

  it("resolves a slug to its publication, and a miss to null", () => {
    const cards: CorpusEntry[] = [{ slug: "a", payload: "A1" }, { slug: "a", payload: "A2" }];
    const docs: DocumentIndex = { a: "WHOLE" };
    expect(payloadForShortLink(cards, docs, { slug: "a", index: null })).toBe("WHOLE");
    expect(payloadForShortLink(cards, docs, { slug: "a", index: 1 })).toBe("A1");
    expect(payloadForShortLink(cards, docs, { slug: "a", index: 2 })).toBe("A2");
    // Past the end resolves to nothing rather than the publication: handing over
    // two recipes to someone who asked for the third is the failure to prevent.
    expect(payloadForShortLink(cards, docs, { slug: "a", index: 3 })).toBeNull();
    expect(payloadForShortLink(cards, docs, { slug: "b", index: null })).toBeNull();
  });

  it("falls back to the card when the cards already carry the document whole", () => {
    // 35 of the 48 recipe-bearing corpus documents hold one recipe, so the
    // projection is the identity and `documents` holds no entry for them.
    const cards: CorpusEntry[] = [{ slug: "solo", payload: "ONLY" }];
    expect(payloadForShortLink(cards, {}, { slug: "solo", index: null })).toBe("ONLY");
    expect(payloadForShortLink(cards, {}, { slug: "solo", index: 1 })).toBe("ONLY");
  });

  it("every corpus slug resolves both ways, and every short URL stays trivially QR-able", () => {
    expect(index.length).toBeGreaterThan(0);
    for (const [i, e] of index.entries()) {
      const n = index.filter((x) => x.slug === e.slug).indexOf(e) + 1;
      expect(payloadForShortLink(index, documents, { slug: e.slug, index: n }), e.slug).toBe(e.payload);
      expect(payloadForShortLink(index, documents, { slug: e.slug, index: null }), e.slug).toBeTruthy();
      // The point of the short form: the printed URL never grows with the
      // document, so level-M capacity is never in question again.
      expect(`${SITE_URL}/r/?s=${e.slug}&i=${i + 1}`.length).toBeLessThan(100);
    }
  });

  it("a card's scoped payload carries exactly the one recipe it advertises", () => {
    for (const e of index) {
      const doc = JSON.parse(Buffer.from(e.payload, "base64url").toString("utf8"));
      expect(doc.recipes, e.slug).toHaveLength(1);
    }
  });

  it("names the unknown-slug failure honestly", () => {
    expect(failCopy("unknown_slug")).toMatch(/short link/i);
  });
});

// Level M caps at 2,331 bytes; above it qrSvg falls back to level L rather
// than throwing. Pad with a base64url ALPHABET, never a run of "A": mixed case
// forces QR's byte mode and its 2,953-byte ceiling, while an all-uppercase run
// is encodable in alphanumeric mode (4,296) and would measure a mode this code
// never uses.
const payload = (n: number) =>
  Array.from({ length: n }, (_, i) => "aB3xY_z9-Qw"[i % 11]).join("");

describe("qrSvg capacity fallback", () => {
  it("still renders a QR for a URL beyond level-M capacity", async () => {
    const svg = await qrSvg(`${SITE_URL}/r/?d=${payload(2600)}`);
    expect(svg).toContain("<svg");
  });

  it("renders short URLs unchanged", async () => {
    const svg = await qrSvg(`${SITE_URL}/r/?s=tetsu-kasuya-4-6-basic`);
    expect(svg).toContain("<svg");
  });

  // Rejecting would make "no QR at any level" indistinguishable from a crash, and
  // an uncaught await leaves a dead button. Null is a value a caller must handle.
  it("returns null rather than rejecting when no level can hold the URL", async () => {
    await expect(qrSvg(`${SITE_URL}/r/?d=${payload(3400)}`)).resolves.toBeNull();
  });
});
