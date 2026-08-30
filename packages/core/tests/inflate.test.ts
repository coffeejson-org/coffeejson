import { describe, expect, test } from "vitest";
import { deflateSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join } from "node:path";
import { inflateZlib } from "../src/inflate";

const LIMIT = 8192;
const enc = new TextEncoder();
const dec = new TextDecoder();

const zlibOf = (s: string, level = 9) =>
  new Uint8Array(deflateSync(Buffer.from(s, "utf8"), { level }));

describe("inflateZlib", () => {
  test("inflates a stream written by a standard deflate", () => {
    const text = '{"coffeejson":"1.0","recipes":[{"title":"V60"}]}';
    const r = inflateZlib(zlibOf(text), LIMIT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(dec.decode(r.bytes)).toBe(text);
  });

  test("inflates a stored block (level 0, no compression)", () => {
    const text = '{"coffeejson":"1.0"}';
    const r = inflateZlib(zlibOf(text, 0), LIMIT);
    expect(r.ok && dec.decode(r.bytes)).toBe(text);
  });

  test("inflates a fixed-Huffman block", () => {
    // A short input keeps the encoder on the fixed code table.
    const text = "aaaa";
    const r = inflateZlib(zlibOf(text), LIMIT);
    expect(r.ok && dec.decode(r.bytes)).toBe(text);
  });

  test("inflates multi-byte UTF-8 unchanged", () => {
    const text = '{"title":"朝のV60 — café"}';
    const r = inflateZlib(zlibOf(text), LIMIT);
    expect(r.ok && dec.decode(r.bytes)).toBe(text);
  });

  test("stops at the output limit instead of inflating fully", () => {
    const bomb = zlibOf("x".repeat(2_000_000));
    expect(bomb.length).toBeLessThan(4096); // small in, huge out
    const r = inflateZlib(bomb, LIMIT);
    expect(!r.ok && r.error).toBe("too_large");
  });

  test("accepts output of exactly the limit", () => {
    const r = inflateZlib(zlibOf("x".repeat(LIMIT)), LIMIT);
    expect(r.ok && r.bytes.length).toBe(LIMIT);
  });

  test("rejects a compression method that is not deflate", () => {
    const b = zlibOf("{}");
    b[0] = 0x79; // CM = 9
    expect(!inflateZlib(b, LIMIT).ok).toBe(true);
  });

  test("rejects a header whose check bits fail", () => {
    const b = zlibOf("{}");
    b[1] = (b[1]! + 1) & 0xff; // breaks (b0<<8|b1) % 31 === 0
    const r = inflateZlib(b, LIMIT);
    expect(!r.ok && r.error).toBe("bad_header");
  });

  test("rejects a stream that declares a preset dictionary", () => {
    const b = zlibOf("{}");
    b[1] = b[1]! | 0x20; // FDICT
    const r = inflateZlib(b, LIMIT);
    expect(!r.ok && r.error).toBe("bad_header");
  });

  test("rejects a corrupt Adler-32 checksum", () => {
    const b = zlibOf('{"coffeejson":"1.0"}');
    b[b.length - 1] = (b[b.length - 1]! ^ 0xff) & 0xff;
    const r = inflateZlib(b, LIMIT);
    expect(!r.ok && r.error).toBe("corrupt");
  });

  test("rejects a truncated stream", () => {
    const b = zlibOf('{"coffeejson":"1.0","recipes":[{"title":"V60"}]}');
    const r = inflateZlib(b.slice(0, b.length - 6), LIMIT);
    expect(!r.ok && r.error).toBe("corrupt");
  });

  test("rejects input too short to hold a header", () => {
    expect(!inflateZlib(new Uint8Array([0x78]), LIMIT).ok).toBe(true);
  });

  test("rejects plain JSON bytes (the discriminator's other branch)", () => {
    const r = inflateZlib(enc.encode('{"coffeejson":"1.0"}'), LIMIT);
    expect(!r.ok && r.error).toBe("bad_header");
  });
});

describe("corpus round-trip", () => {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const jsonIn = (dir: string): [string, string][] =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith(".json") && f !== "catalog.json")
      .map((f) => [join(dir, f), readFileSync(join(root, dir, f), "utf8")]);

  const recipes = jsonIn("recipes");
  const corpus = [...recipes, ...jsonIn("fixtures/valid")];

  // No literal count: the corpus grows and shrinks, and a number here would be
  // one more place to edit for it. The catalog is the corpus's own manifest, so
  // agreeing with it is both the stronger check and the maintenance-free one.
  test("the recipe corpus is all there", () => {
    const catalog: { recipes: { slug: string }[] } = JSON.parse(
      readFileSync(join(root, "recipes/catalog.json"), "utf8"),
    );
    const onDisk = recipes.map(([name]) => basename(name, ".json")).sort();
    expect(onDisk.length).toBeGreaterThan(0);
    expect(onDisk).toEqual(catalog.recipes.map((r) => r.slug).sort());
  });

  test("every corpus document survives deflate → inflateZlib byte-identically", () => {
    for (const [name, raw] of corpus) {
      const json = JSON.stringify(JSON.parse(raw)); // the payload form: minified
      const bytes = enc.encode(json);
      for (const level of [1, 6, 9]) {
        const r = inflateZlib(new Uint8Array(deflateSync(bytes, { level })), LIMIT);
        expect(r.ok, `${name} @${level}`).toBe(true);
        if (r.ok) {
          expect(r.bytes.length, `${name} @${level}`).toBe(bytes.length);
          expect(dec.decode(r.bytes), `${name} @${level}`).toBe(json);
        }
      }
    }
  });
});
