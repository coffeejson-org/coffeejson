// A synchronous zlib (RFC 1950) inflate, no dependency: a share payload must
// render in the first frame a page paints, and DecompressionStream is
// asynchronous. Producers use CompressionStream, so no encoder lives here.
// Output is bounded before each write — a 1 KB payload can inflate to megabytes.

export type InflateError = "bad_header" | "too_large" | "corrupt";
export type InflateResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: InflateError };

const fail = (error: InflateError): InflateResult => ({ ok: false, error });

// Errors surface from deep inside the bit reader, so they travel as a tagged
// throw. Anything else that escapes is untrusted input, and reads as corrupt.
const bail = (error: InflateError): never => {
  throw { inflateError: error };
};

// RFC 1951 §3.2.5 — length and distance bases with their extra-bit counts.
const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
// RFC 1951 §3.2.7 — the order code lengths are written in.
const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

// Counts-per-length plus symbols in code order: decoding walks lengths 1..15
// against the running first code, so there is no lookup table to build.
type Huff = { counts: Uint16Array; symbols: Uint16Array };

const build = (lengths: Uint8Array): Huff => {
  const n = lengths.length;
  const counts = new Uint16Array(16);
  for (let i = 0; i < n; i++) {
    const l = lengths[i]!;
    counts[l] = counts[l]! + 1;
  }
  counts[0] = 0;
  // Over-subscribed lengths would decode past the symbol table. An incomplete
  // code (left > 0) is legal — a distance code may hold a single symbol.
  let left = 1;
  for (let l = 1; l < 16; l++) {
    left = (left << 1) - counts[l]!;
    if (left < 0) bail("corrupt");
  }
  const offsets = new Uint16Array(16);
  for (let l = 1; l < 16; l++) offsets[l] = offsets[l - 1]! + counts[l - 1]!;
  const symbols = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const l = lengths[i]!;
    if (l) {
      symbols[offsets[l]!] = i;
      offsets[l] = offsets[l]! + 1;
    }
  }
  return { counts, symbols };
};

let fixedLit: Huff | undefined;
let fixedDist: Huff | undefined;
const fixed = (): [Huff, Huff] => {
  if (!fixedLit || !fixedDist) {
    const l = new Uint8Array(288);
    l.fill(8, 0, 144);
    l.fill(9, 144, 256);
    l.fill(7, 256, 280);
    l.fill(8, 280, 288);
    fixedLit = build(l);
    fixedDist = build(new Uint8Array(30).fill(5));
  }
  return [fixedLit, fixedDist];
};

const adler32 = (b: Uint8Array, n: number): number => {
  let a = 1;
  let s = 0;
  for (let i = 0; i < n; i++) {
    a = (a + b[i]!) % 65521;
    s = (s + a) % 65521;
  }
  return ((s << 16) | a) >>> 0;
};

/**
 * Inflate a zlib stream, refusing to write more than `limit` output bytes. It
 * validates the whole zlib header itself, because it is also the bound-enforcing
 * entry point; the codec's one-byte sniff exists only to pick the error kind.
 */
export function inflateZlib(input: Uint8Array, limit: number): InflateResult {
  // 2 header bytes, at least 1 deflate byte, 4 checksum bytes.
  if (input.length < 7) return fail("bad_header");
  const cmf = input[0]!;
  const flg = input[1]!;
  if ((cmf & 0x0f) !== 8) return fail("bad_header"); // CM: deflate only
  if (cmf >> 4 > 7) return fail("bad_header"); // CINFO: window ≤ 32 KiB
  if (((cmf << 8) | flg) % 31 !== 0) return fail("bad_header"); // FCHECK
  if (flg & 0x20) return fail("bad_header"); // FDICT: no preset dictionary

  const out = new Uint8Array(limit);
  let o = 0; // bytes written
  let p = 2; // read position, past the zlib header
  let bitbuf = 0;
  let bitcnt = 0;

  // `need` is at most 16, and bitcnt is always ≤ 7 on entry, so the shifted
  // value stays inside a 32-bit int.
  const bits = (need: number): number => {
    let val = bitbuf;
    while (bitcnt < need) {
      if (p >= input.length) bail("corrupt");
      val |= input[p++]! << bitcnt;
      bitcnt += 8;
    }
    bitbuf = val >>> need;
    bitcnt -= need;
    return val & ((1 << need) - 1);
  };

  const decode = (h: Huff): number => {
    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const count = h.counts[len]!;
      if (code - first < count) return h.symbols[index + (code - first)]!;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    return bail("corrupt");
  };

  try {
    let last = 0;
    do {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        // Stored: the rest of the current byte is discarded, then LEN/NLEN.
        bitbuf = 0;
        bitcnt = 0;
        if (p + 4 > input.length) bail("corrupt");
        const len = input[p]! | (input[p + 1]! << 8);
        const nlen = input[p + 2]! | (input[p + 3]! << 8);
        if ((len ^ 0xffff) !== nlen) bail("corrupt");
        p += 4;
        if (p + len > input.length) bail("corrupt");
        if (o + len > limit) bail("too_large");
        out.set(input.subarray(p, p + len), o);
        o += len;
        p += len;
        continue;
      }
      if (type === 3) bail("corrupt");

      let lit: Huff;
      let dist: Huff;
      if (type === 1) {
        [lit, dist] = fixed();
      } else {
        const hlit = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        if (hlit > 286 || hdist > 30) bail("corrupt");
        const clen = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) clen[ORDER[i]!] = bits(3);
        const code = build(clen);
        const lengths = new Uint8Array(hlit + hdist);
        for (let i = 0; i < lengths.length; ) {
          const sym = decode(code);
          let value = 0;
          let repeat = 1;
          if (sym < 16) value = sym;
          else if (sym === 16) {
            if (i === 0) bail("corrupt");
            value = lengths[i - 1]!;
            repeat = 3 + bits(2);
          } else if (sym === 17) repeat = 3 + bits(3);
          else repeat = 11 + bits(7);
          if (i + repeat > lengths.length) bail("corrupt");
          while (repeat--) lengths[i++] = value;
        }
        lit = build(lengths.subarray(0, hlit));
        dist = build(lengths.subarray(hlit));
      }

      for (;;) {
        const sym = decode(lit);
        if (sym < 256) {
          if (o >= limit) bail("too_large");
          out[o++] = sym;
          continue;
        }
        if (sym === 256) break;
        const li = sym - 257;
        if (li >= 29) bail("corrupt");
        const length = LBASE[li]! + bits(LEXT[li]!);
        const di = decode(dist);
        if (di >= 30) bail("corrupt");
        const distance = DBASE[di]! + bits(DEXT[di]!);
        if (distance > o) bail("corrupt"); // a reference before the output start
        if (o + length > limit) bail("too_large");
        for (let k = 0; k < length; k++) {
          out[o] = out[o - distance]!;
          o++;
        }
      }
    } while (!last);

    // The stream ends on a bit boundary, so the checksum starts at the current
    // read position. Nothing may follow it: trailing bytes mean a damaged payload.
    if (p + 4 !== input.length) bail("corrupt");
    const want =
      ((input[p]! << 24) | (input[p + 1]! << 16) | (input[p + 2]! << 8) | input[p + 3]!) >>> 0;
    if (adler32(out, o) !== want) bail("corrupt");
  } catch (e) {
    return fail((e as { inflateError?: InflateError }).inflateError ?? "corrupt");
  }

  return { ok: true, bytes: out.slice(0, o) };
}
