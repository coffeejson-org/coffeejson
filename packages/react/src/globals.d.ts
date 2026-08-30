// Not lib.dom.d.ts: adding a name here widens the runtimes the package claims.
// Every name is available in browsers and Node 18+, unlike window/document, which
// `useBrewAlong` never references (hygiene.test.ts). `clearTimeout` takes
// `unknown` because the two typecheck configurations disagree on the handle type.
declare function setTimeout(callback: () => void, ms?: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare const performance: { now(): number };
