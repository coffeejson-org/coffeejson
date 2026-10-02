import { encodePayload } from "@coffeejson/core";

const fromBase64Url = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const toBase64Url = (bytes: Uint8Array): string => {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * A share-link payload, zlib-compressed where that makes it shorter. The bytes
 * compressed are the ones `encodePayload` produces, so the two forms decode to
 * the same document. `compressed: false` means the plain form was kept, because
 * the browser has no `CompressionStream` or compressing made nothing shorter.
 */
export async function compressPayload(
  doc: unknown,
): Promise<{ payload: string; compressed: boolean }> {
  const plain = encodePayload(doc);
  if (typeof CompressionStream === "undefined")
    return { payload: plain, compressed: false };
  // "deflate" is the zlib container (RFC 1950), which is the form the share-URL
  // binding names. "deflate-raw" has no header, and a reader would reject it.
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  void writer.write(fromBase64Url(plain) as BufferSource);
  void writer.close();
  const chunks: number[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(...(value as Uint8Array));
  }
  const packed = toBase64Url(Uint8Array.from(chunks));
  return packed.length < plain.length
    ? { payload: packed, compressed: true }
    : { payload: plain, compressed: false };
}
