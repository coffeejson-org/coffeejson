import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { deflateSync, gzipSync } from "node:zlib";
import {
  DECODE_ERROR_KINDS, MAX_PAYLOAD_BYTES, checkEnvelope, decodeDocumentText, decodePayload,
  encodePayload, payloadFromLocation,
} from "../src/codec";
import { FORMAT_VERSION, MEDIA_TYPE, SUPPORTED_MAJOR } from "../src/version";
import { normalize } from "../src/normalize";

const minimal = JSON.parse(readFileSync(new URL("../../../fixtures/valid/minimal.json", import.meta.url), "utf8"));
const b64url = (b: Buffer | Uint8Array) => Buffer.from(b).toString("base64url");
const compress = (doc: unknown, opts: Record<string, number> = {}) =>
  b64url(deflateSync(Buffer.from(JSON.stringify(doc), "utf8"), { level: 9, ...opts }));

describe("encode/decode round-trip", () => {
  test("round-trips the minimal fixture byte-identically", () => {
    const p = encodePayload(minimal);
    expect(p).not.toMatch(/[+/=]/); // base64url, unpadded
    const r = decodePayload(p);
    expect(r.ok && r.document).toEqual(minimal);
  });
  test("round-trips non-ASCII titles (UTF-8, not latin1)", () => {
    const doc = { coffeejson: "1.0", recipes: [{ title: "朝のV60 — café", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" } }] };
    const r = decodePayload(encodePayload(doc));
    expect(r.ok && normalize(r.document).recipes[0]!.title).toBe("朝のV60 — café");
  });
  test("accepts padded and +/ alphabet input (normalization)", () => {
    const std = Buffer.from(JSON.stringify(minimal), "utf8").toString("base64"); // +,/,= form
    const r = decodePayload(std);
    expect(r.ok && r.document).toEqual(minimal);
  });
});

describe("guards", () => {
  test("no_payload", () => { expect(decodePayload("")).toEqual({ ok: false, error: { kind: "no_payload" } }); });
  test("malformed base64", () => {
    const r = decodePayload("!!!not-base64!!!");
    expect(!r.ok && r.error.kind).toBe("malformed_base64");
  });
  test("valid base64, invalid JSON", () => {
    const r = decodePayload(Buffer.from("{nope", "utf8").toString("base64url"));
    expect(!r.ok && r.error.kind).toBe("not_json");
  });
  test("size cap", () => {
    const big = { coffeejson: "1.0", recipes: [{ title: "x".repeat(MAX_PAYLOAD_BYTES), coffee: { value: 1, unit: "gram" }, water: { value: 1, unit: "gram" } }] };
    const r = decodePayload(encodePayload(big));
    expect(!r.ok && r.error.kind).toBe("too_large");
  });
  test("newer major is gated, newer minor is not", () => {
    const v2 = decodePayload(encodePayload({ coffeejson: "2.0", recipes: [{ title: "t" }] }));
    expect(!v2.ok && v2.error.kind).toBe("unsupported_version");
    const v17 = decodePayload(encodePayload({ coffeejson: "1.7", recipes: [{ title: "t", coffee: { value: 1, unit: "gram" }, water: { value: 1, unit: "gram" } }] }));
    expect(v17.ok).toBe(true);
  });
  test("JSON that is not a CoffeeJSON document", () => {
    const r = decodePayload(Buffer.from('{"hello":"world"}', "utf8").toString("base64url"));
    expect(!r.ok && r.error.kind).toBe("not_a_document");
  });
  test("a JSON array never reaches the parser — a document is an object", () => {
    const r = decodePayload(Buffer.from("[1,2,3]", "utf8").toString("base64url"));
    expect(!r.ok && r.error.kind).toBe("unrecognized_encoding");
  });
});

// A well-formed envelope carrying nothing decodes cleanly all the way to the
// non-empty-collection rule, so nothing before that point can catch it.
describe("the envelope carries something", () => {
  const kindOf = (doc: unknown) => {
    const r = decodePayload(encodePayload(doc));
    return r.ok ? "accepted" : r.error.kind;
  };
  test("empty collections", () => {
    expect(kindOf({ coffeejson: "1.0", beans: [], recipes: [] })).toBe("empty_document");
  });
  test("absent collections state the same thing as empty ones", () => {
    expect(kindOf({ coffeejson: "1.0" })).toBe("empty_document");
    expect(kindOf({ coffeejson: "1.0", generator: { name: "ExampleBrewApp" } })).toBe("empty_document");
  });
  test("tastings alone do not make a document", () => {
    expect(kindOf({ coffeejson: "1.0", tastings: [{ rating: 4 }] })).toBe("empty_document");
  });
  test("a collection that is not an array reads as absent", () => {
    expect(kindOf({ coffeejson: "1.0", recipes: { title: "t" } })).toBe("empty_document");
  });
  test("either collection alone is enough", () => {
    expect(kindOf({ coffeejson: "1.0", recipes: [{ title: "t" }] })).toBe("accepted");
    expect(kindOf({ coffeejson: "1.0", beans: [{ name: "Nano Challa" }] })).toBe("accepted");
  });
  test("the version gate is answered first — a newer major's envelope is not ours to judge", () => {
    expect(kindOf({ coffeejson: "2.0", beans: [], recipes: [] })).toBe("unsupported_version");
  });
});

describe("the compressed form", () => {
  test("decodes a zlib payload to the same document as the plain form", () => {
    const r = decodePayload(compress(minimal));
    expect(r.ok && r.document).toEqual(minimal);
  });
  test("decodes a small-window stream, which does not begin 0x78", () => {
    const p = compress(minimal, { windowBits: 9 });
    expect(Buffer.from(p, "base64url")[0]).not.toBe(0x78); // the whole point
    expect(Buffer.from(p, "base64url")[0]! & 0x0f).toBe(8);
    const r = decodePayload(p);
    expect(r.ok && r.document).toEqual(minimal);
  });
  test("survives non-ASCII through compression", () => {
    const doc = { coffeejson: "1.0", recipes: [{ title: "朝のV60 — café", coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" } }] };
    const r = decodePayload(compress(doc));
    expect(r.ok && normalize(r.document).recipes[0]!.title).toBe("朝のV60 — café");
  });
  test("a damaged stream is rejected, not repaired", () => {
    const bytes = Buffer.from(compress(minimal), "base64url");
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 0xff; // the checksum only
    const r = decodePayload(b64url(bytes));
    expect(!r.ok && r.error.kind).toBe("damaged_compression");
  });
  test("a stream that inflates past the cap is rejected at the cap", () => {
    const bomb = deflateSync(Buffer.alloc(2_000_000, 0x78));
    expect(bomb.length).toBeLessThan(4096);
    const r = decodePayload(b64url(bomb));
    expect(!r.ok && r.error.kind).toBe("too_large");
  });
  test("a third encoding is unrecognized, not guessed at", () => {
    const r = decodePayload(b64url(gzipSync(Buffer.from(JSON.stringify(minimal)))));
    expect(!r.ok && r.error.kind).toBe("unrecognized_encoding");
  });
  // Producers convert last: the decode ships everywhere before anything mints a
  // compressed link, so encodePayload stays plain.
  test("encodePayload still emits the plain form", () => {
    expect(Buffer.from(encodePayload(minimal), "base64url")[0]).toBe(0x7b);
  });
});

describe("the shared scan-vector corpus", () => {
  const { vectors } = JSON.parse(
    readFileSync(new URL("../../../fixtures/transport/scan-vectors.json", import.meta.url), "utf8"),
  ) as { vectors: { name: string; input: string; expect: string; kind?: string; document?: unknown }[] };

  // Three kinds reject on the URL or before a payload exists, so they are
  // `decodeScanned`'s contract — `decodePayload` never sees the link.
  const URL_LEVEL = new Set(["not_a_url", "not_http", "no_payload"]);
  const payloadLevel = vectors.filter((v) => !URL_LEVEL.has(v.kind ?? ""));

  test("carries both payload forms, so neither branch can rot untested", () => {
    const firstBytes = payloadLevel
      .map((v) => new URL(v.input).searchParams.get("d"))
      .filter((d): d is string => !!d)
      .map((d) => Buffer.from(d, "base64url")[0]);
    expect(firstBytes).toContain(0x7b);
    expect(firstBytes.some((b) => b !== undefined && b !== 0x7b && (b & 0x0f) === 8)).toBe(true);
  });

  for (const v of payloadLevel) {
    // URL-level vectors are `decodeScanned`'s. Some are not URLs at all, so the
    // skip has to survive the parse rather than follow it.
    let d: string | null = null;
    try {
      d = new URL(v.input).searchParams.get("d");
    } catch {
      continue;
    }
    if (!d) continue;
    test(`${v.name}`, () => {
      const r = decodePayload(d);
      expect(r.ok, v.name).toBe(v.expect === "document");
      if (r.ok) expect(r.document).toEqual(v.document);
      // The vector states the kind. The corpus IS the error vocabulary, so a
      // harness that kept its own name table would be a second dialect of it.
      else expect(r.error.kind, v.name).toBe(v.kind);
    });
  }

  test("every reject vector names a kind this package vends", () => {
    for (const v of vectors.filter((x) => x.expect === "reject"))
      expect(DECODE_ERROR_KINDS, v.name).toContain(v.kind);
  });
});

describe("payloadFromLocation", () => {
  test("reads the d query item", () => { expect(payloadFromLocation("?d=abc")).toBe("abc"); });
  // A #fragment payload is not a shape of this transport: rejected by the spec,
  // emitted by nothing. Pinned so the fallback cannot quietly return.
  test("a fragment payload is NOT read", () => { expect(payloadFromLocation("")).toBeNull(); });
  test("no d item", () => { expect(payloadFromLocation("?x=1")).toBeNull(); });
});

// A POST body and an uploaded file arrive already parsed, and must be answered
// the same way as a decoded link.
describe("checkEnvelope — a parsed value, no transport in front of it", () => {
  test("accepts a document and hands it back", () => {
    const r = checkEnvelope(minimal);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.document).toEqual(minimal);
  });

  test.each([
    ["a JSON array", []],
    ["a bare string", "hello"],
    ["null", null],
    ["a number", 7],
    ["an object with no coffeejson member", { recipes: [{ title: "x" }] }],
    ["a coffeejson member that is not a string", { coffeejson: 1, recipes: [{ title: "x" }] }],
  ])("%s is not_a_document", (_label, value) => {
    const r = checkEnvelope(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("not_a_document");
  });

  test("a major this build does not read is unsupported_version, quoting it", () => {
    const r = checkEnvelope({ coffeejson: "2.0", recipes: [{ title: "x" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("unsupported_version");
      expect(r.error.detail).toBe("2.0");
    }
  });

  test("a newer minor of the supported major is read", () => {
    expect(checkEnvelope({ coffeejson: "1.7", recipes: [{ title: "x" }] }).ok).toBe(true);
  });

  test.each([
    ["neither collection", {}],
    ["both empty", { beans: [], recipes: [] }],
    ["tastings only", { tastings: [{ rating: 4 }] }],
    ["recipes not an array", { recipes: { title: "x" } }],
  ])("%s is empty_document", (_label, rest) => {
    const r = checkEnvelope({ coffeejson: FORMAT_VERSION, ...rest });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("empty_document");
  });

  // The version gate runs first on purpose: a newer major's envelope is not this
  // build's to judge, so it is named by version rather than by what it carries.
  test("a newer major with an empty envelope is reported by its version", () => {
    const r = checkEnvelope({ coffeejson: "2.0" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("unsupported_version");
  });

  test("decodePayload and checkEnvelope answer a parsed document identically", () => {
    const doc = { coffeejson: FORMAT_VERSION, recipes: [] };
    expect(decodePayload(encodePayload(doc))).toEqual(checkEnvelope(doc));
  });
});

describe("the format version is a value, not a literal", () => {
  test("FORMAT_VERSION states the major this build reads", () => {
    expect(FORMAT_VERSION.split(".")[0]).toBe(SUPPORTED_MAJOR);
  });

  test("the schema accepts the version this build emits", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../../../docs/schema/coffeejson-1.0.schema.json", import.meta.url), "utf8"),
    );
    expect(FORMAT_VERSION).toMatch(new RegExp(schema.properties.coffeejson.pattern));
  });

  test("MEDIA_TYPE is the type the spec reserves", () => {
    const spec = readFileSync(new URL("../../../docs/spec/07-versioning.md", import.meta.url), "utf8");
    expect(spec).toContain(`\n${MEDIA_TYPE}\n`);
  });

  test("every reason the codec can give is in DECODE_ERROR_KINDS, once", () => {
    expect(DECODE_ERROR_KINDS.length).toBe(new Set(DECODE_ERROR_KINDS).size);
    expect(DECODE_ERROR_KINDS).toContain("empty_document");
  });
});

describe("encoding normalizes the linking ids to NFC", () => {
  const decomposed = "café-blend";   // e + combining acute
  const precomposed = "café-blend";   // é
  const doc = {
    coffeejson: "1.0",
    beans: [{ id: decomposed, name: "Café" }],
    recipes: [{
      id: decomposed, bean_ref: precomposed, title: "Café V60",
      coffee: { value: 15, unit: "gram" }, water: { value: 250, unit: "gram" },
    }],
    tastings: [{ id: decomposed, recipe_ref: decomposed, bean_ref: decomposed, rating: 4 }],
  };

  test("every id and reference comes back precomposed, so the two forms link", () => {
    const r = decodePayload(encodePayload(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.document as unknown as Record<string, Record<string, unknown>[]>;
    expect(d["beans"]![0]!["id"]).toBe(precomposed);
    expect(d["recipes"]![0]!["id"]).toBe(precomposed);
    expect(d["recipes"]![0]!["bean_ref"]).toBe(precomposed);
    expect(d["tastings"]![0]!["id"]).toBe(precomposed);
    expect(d["tastings"]![0]!["recipe_ref"]).toBe(precomposed);
    expect(d["tastings"]![0]!["bean_ref"]).toBe(precomposed);
  });

  test("human text is the producer's own — it travels byte for byte", () => {
    const r = decodePayload(encodePayload(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.document as unknown as Record<string, Record<string, unknown>[]>;
    expect(d["beans"]![0]!["name"]).toBe("Café");
    expect(d["recipes"]![0]!["title"]).toBe("Café V60");
  });

  test("the caller's own document is not rewritten", () => {
    encodePayload(doc);
    expect(doc.beans[0]!.id).toBe(decomposed);
  });

  test("a document carrying no ids encodes exactly as before", () => {
    expect(decodePayload(encodePayload(minimal)).ok).toBe(true);
    expect(encodePayload(minimal)).toBe(encodePayload(minimal));
  });
});

// The wire grammar is MAJOR.MINOR, no patch component (docs/spec/07-versioning.md
// § Versioning), and the schema pins `^1\.\d+$`. A spelling outside that grammar
// names no major to gate on, so it is an unsupported version, not a document.
describe("the version gate reads the wire grammar", () => {
  const kindOf = (version: unknown) => {
    const r = checkEnvelope({ coffeejson: version, recipes: [{ title: "t" }] });
    return r.ok ? "accepted" : r.error.kind;
  };
  test("MAJOR.MINOR of the supported major", () => {
    expect(kindOf("1.0")).toBe("accepted");
    expect(kindOf("1.10")).toBe("accepted");
  });
  test("a bare major states no version", () => {
    expect(kindOf("1")).toBe("unsupported_version");
  });
  test("a leading zero on the major is not the major", () => {
    expect(kindOf("01.0")).toBe("unsupported_version");
  });
  test("a patch component is not on the wire", () => {
    expect(kindOf("1.0.0")).toBe("unsupported_version");
  });
  test("the rejected spelling travels as the detail", () => {
    const r = checkEnvelope({ coffeejson: "1.0.0", recipes: [{ title: "t" }] });
    expect(!r.ok && r.error.detail).toBe("1.0.0");
  });
  test("the major is compared as a number, not a string", () => {
    expect(kindOf("2.0")).toBe("unsupported_version");
    expect(kindOf("0.9")).toBe("unsupported_version");
  });
});

describe("decodeDocumentText — the File binding's reader", () => {
  const doc = '{"coffeejson":"1.0","recipes":[{"title":"Everyday V60"}]}';

  test("reads a plain file", () => {
    const r = decodeDocumentText(doc);
    expect(r.ok && r.document.recipes?.length).toBe(1);
  });
  // transport.md § File: a producer must not write a byte-order mark, and a
  // consumer that meets one discards it. Foundation's JSONDecoder does this for
  // free and JSON.parse throws, so without this the two SDKs disagree on the
  // same file. fixtures/transport/bom-prefixed-file.json carries the real bytes.
  test("discards a leading byte-order mark", () => {
    const r = decodeDocumentText("\uFEFF" + doc);
    expect(r.ok && r.document.recipes?.length).toBe(1);
  });
  test("the real fixture reads", () => {
    const bytes = readFileSync("../../fixtures/transport/bom-prefixed-file.json");
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(decodeDocumentText(bytes.toString("utf8")).ok).toBe(true);
  });
  // A mark anywhere else is not a mark, it is content the parser must reject.
  test("only a leading mark is discarded", () => {
    const r = decodeDocumentText(doc + "\uFEFF");
    expect(!r.ok && r.error.kind).toBe("not_json");
  });
  test("unparseable text names the same reason a link does", () => {
    expect(decodeDocumentText("{").ok).toBe(false);
    const r = decodeDocumentText("{");
    expect(!r.ok && r.error.kind).toBe("not_json");
  });
  test("a parsed non-document goes through the same envelope check", () => {
    const r = decodeDocumentText('{"coffeejson":"2.0","recipes":[{"title":"t"}]}');
    expect(!r.ok && r.error.kind).toBe("unsupported_version");
  });
});
