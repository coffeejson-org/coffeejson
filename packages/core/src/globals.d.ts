// Lowest-common-denominator platform globals, deliberately not lib.dom.d.ts:
// adding a name here is a portability decision.
declare function atob(data: string): string;
declare function btoa(data: string): string;
declare class TextDecoder {
  constructor(label?: string, options?: { fatal?: boolean });
  decode(input?: Uint8Array): string;
}
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class URLSearchParams {
  constructor(init?: string);
  get(name: string): string | null;
}
// `URL` stays out: a declaration this minimal would shadow the real one, so
// `decodeScanned` — its only user — declares it file-locally instead.
