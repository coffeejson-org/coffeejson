/** A copy-pasteable system-prompt fragment for a model asked to emit CoffeeJSON. */
export declare const SYSTEM_PROMPT: string;

/** One few-shot pair: the request a user makes, and the document that answers it. */
export interface Example {
  readonly prompt: string;
  readonly note: string;
  readonly doc: unknown;
}
export declare const EXAMPLES: readonly Example[];

/** One anti-example: what a model writes, what it should have written, and why. */
export interface Pitfall {
  readonly wrong: string;
  readonly right: string;
  readonly why: string;
}
export declare const PITFALLS: readonly Pitfall[];
