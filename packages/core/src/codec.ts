import { inflateZlib } from "./inflate.js";
import { isObj } from "./json.js";
import { SUPPORTED_MAJOR } from "./version.js";

export const MAX_PAYLOAD_BYTES = 8192;

/**
 * Why a payload did not become a document — the rejections the published scan
 * vectors define, in decode order, so every implementation reports the same
 * outcomes. Enumerate the array rather than transcribing the union.
 *
 * **The boundary.** This codec reads the transport framing and the envelope and
 * stops; it never reads inside a recipe or a bean. A payload can decode cleanly
 * and still be schema-invalid — saying so is the document layer's job. A
 * rejection that must look past the two collections does not belong here.
 */
export const DECODE_ERROR_KINDS = [
  /** No `d` parameter, or an empty one — there is no payload to read. */
  "no_payload",
  /** Characters outside the base64url alphabet. */
  "malformed_base64",
  /** The first byte is neither `{` nor a zlib header: an encoding we do not define. */
  "unrecognized_encoding",
  /** A zlib stream that did not survive the wire — bad frame or failed checksum. */
  "damaged_compression",
  /** The document exceeds the 8192-byte cap, as sent or after inflating. */
  "too_large",
  "not_utf8",
  /** Valid UTF-8, but not JSON. */
  "not_json",
  /** JSON, but not a CoffeeJSON document — no `coffeejson` member. */
  "not_a_document",
  /** A major version this build does not support. */
  "unsupported_version",
  /** Neither a non-empty `beans` nor a non-empty `recipes` — the envelope
   *  requires one, so this document names nothing to act on. */
  "empty_document",
  /** The scanned text is not a URL at all — `decodeScanned` only. */
  "not_a_url",
  /** A URL, but not http(s) — a `javascript:` or `data:` scan. `decodeScanned` only. */
  "not_http",
] as const;

export type DecodeError = {
  kind: (typeof DECODE_ERROR_KINDS)[number];
  detail?: string;
};
/**
 * What a decode establishes and no more: an envelope past the version gate,
 * carrying a non-empty `beans` or `recipes`. Nothing inside a collection was
 * read, so its elements are `unknown` — `normalize` is the typed read, and it
 * takes an unchecked value. A `CoffeeJSONDocument` is one of these; a decode
 * does not prove the reverse.
 */
export interface DecodedDocument {
  coffeejson: string;
  beans?: unknown[];
  recipes?: unknown[];
  tastings?: unknown[];
  generator?: unknown;
}

export type DecodeResult =
  | { ok: true; document: DecodedDocument }
  | { ok: false; error: DecodeError };

const err = (kind: DecodeError["kind"], detail?: string): DecodeResult => ({
  ok: false,
  error: detail === undefined ? { kind } : { kind, detail },
});

/**
 * The encoding discriminator: one byte, decided once, never retried. A plain
 * payload begins `{`; a zlib stream carries CM 8 in the low nibble and passes the
 * modulo-31 header check, which `0x7B` cannot. Testing `0x78` exactly would
 * reject a legal smaller window.
 */
function payloadBody(
  bytes: Uint8Array,
): { bytes: Uint8Array } | { kind: DecodeError["kind"]; detail?: string } {
  const b0 = bytes[0];
  const b1 = bytes[1];
  if (b0 === 0x7b)
    return bytes.length > MAX_PAYLOAD_BYTES
      ? { kind: "too_large", detail: `${bytes.length} bytes` }
      : { bytes };
  const zlib =
    b0 !== undefined &&
    b1 !== undefined &&
    (b0 & 0x0f) === 8 &&
    ((b0 << 8) | b1) % 31 === 0 &&
    !(b1 & 0x20);
  if (!zlib)
    return {
      kind: "unrecognized_encoding",
      detail:
        b0 === undefined
          ? undefined
          : `first byte 0x${b0.toString(16).toUpperCase().padStart(2, "0")}`,
    };
  // Bounded here: base64 length bounds a plain payload, compression severs that.
  const out = inflateZlib(bytes, MAX_PAYLOAD_BYTES);
  if (out.ok) return { bytes: out.bytes };
  return out.error === "too_large"
    ? { kind: "too_large", detail: `inflates past ${MAX_PAYLOAD_BYTES} bytes` }
    : { kind: "damaged_compression" };
}

export function decodePayload(raw: string): DecodeResult {
  if (!raw) return err("no_payload");
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  let bytes: Uint8Array;
  try {
    const bin = atob(padded);
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return err("malformed_base64");
  }
  const doc = payloadBody(bytes);
  if ("kind" in doc) return err(doc.kind, doc.detail);
  // Two failures, not one: the scan vectors name them separately.
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(doc.bytes);
  } catch {
    return err("not_utf8");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return err("not_json");
  }
  return checkEnvelope(parsed);
}

/**
 * Read a document from the text of a file. Discards a leading byte-order mark,
 * which the File binding says a consumer tolerates rather than rejects, then
 * applies the same envelope check and the same reason vocabulary as a link.
 */
export function decodeDocumentText(text: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return err("not_json");
  }
  return checkEnvelope(parsed);
}

/**
 * The envelope check on already-parsed JSON — a POST body, an uploaded file, a
 * paste. Same rules and same reason vocabulary as a decoded share link, so two
 * paths into one app do not answer differently: a JSON object carrying a
 * `coffeejson` version of a major this build reads, naming at least one
 * non-empty `beans` or `recipes`. Nothing past that; see `DecodeError`.
 */
export function checkEnvelope(value: unknown): DecodeResult {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return err("not_a_document");
  const version = (value as Record<string, unknown>)["coffeejson"];
  if (typeof version !== "string") return err("not_a_document");
  // MAJOR.MINOR, no patch component and no leading zero on the major — the wire
  // grammar the schema pins. A spelling outside it names no major to gate on.
  const major = /^(0|[1-9][0-9]*)\.[0-9]+$/.exec(version)?.[1];
  if (major === undefined || Number(major) !== Number(SUPPORTED_MAJOR))
    return err("unsupported_version", version);
  // Absent and empty are one claim, and a `tastings`-only document is the same
  // rejection — a tasting evaluates something the document must also carry.
  // After the version gate on purpose: a newer major's envelope is not ours to judge.
  const collections = value as Record<string, unknown>;
  const carries = (key: string): boolean => {
    const item = collections[key];
    return Array.isArray(item) && item.length > 0;
  };
  if (!carries("beans") && !carries("recipes")) return err("empty_document");
  return { ok: true, document: value as DecodedDocument };
}

// The linking members, by collection. Association is a byte-exact match, so a
// producer MUST emit these in NFC or the same visible id in two normalization
// forms silently fails to link. Human text is the producer's own and travels
// unchanged.
const LINKING_KEYS: Record<string, readonly string[]> = {
  beans: ["id"],
  recipes: ["id", "bean_ref"],
  tastings: ["id", "recipe_ref", "bean_ref"],
};

// On a copy: encoding a document never rewrites the caller's.
function withNormalizedIds(doc: unknown): unknown {
  if (!isObj(doc)) return doc;
  const out: Record<string, unknown> = { ...doc };
  for (const [collection, keys] of Object.entries(LINKING_KEYS)) {
    const members = out[collection];
    if (!Array.isArray(members)) continue;
    out[collection] = members.map((member) => {
      if (!isObj(member)) return member;
      const copy: Record<string, unknown> = { ...member };
      for (const key of keys) {
        const value = copy[key];
        if (typeof value === "string") copy[key] = value.normalize("NFC");
      }
      return copy;
    });
  }
  return out;
}

export function encodePayload(doc: unknown): string {
  const bytes = new TextEncoder().encode(
    JSON.stringify(withNormalizedIds(doc)),
  );
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The payload carried by a share URL: the `?d=` query item, and nothing else. A
 * `#fragment` is NOT read — chat clients linkify only up to `#`, and nothing
 * defines a fragment form.
 */
export function payloadFromLocation(search: string): string | null {
  return new URLSearchParams(search).get("d");
}

/**
 * A scanned string in, a document or a stated reason out — the whole share-link
 * binding in one call, pinned by `fixtures/transport/scan-vectors.json`. Accepts
 * a link from ANY host: a share link is self-contained, the host never consulted.
 */
// Module-local, not in `globals.d.ts`: a declaration this minimal would shadow
// the real `URL` everywhere it exists.
type MinimalURL = {
  readonly protocol: string;
  readonly searchParams: { get(name: string): string | null };
};
declare const URL: { new (url: string): MinimalURL };

export function decodeScanned(input: string): DecodeResult {
  let url: MinimalURL;
  try {
    url = new URL(input);
  } catch {
    return err("not_a_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return err("not_http", url.protocol);
  return decodePayload(url.searchParams.get("d") ?? "");
}
