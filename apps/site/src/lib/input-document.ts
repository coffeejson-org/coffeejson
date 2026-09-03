import { checkEnvelope, decodeScanned } from "@coffeejson/core";

// What /validator and /generate both accept in their one text box: a pasted
// document, or a share link. Both steps belong to `@coffeejson/core`, so this file
// decides nothing about the format — it picks the branch and phrases the outcome.

const stated = (kind: string, detail?: string): string =>
  `${kind}${detail ? ` (${detail})` : ""}`;

/**
 * @param emptyMessage what to say when there is nothing in the box yet — the two
 *   pages are doing different things with it ("validate" vs "import").
 */
export function documentFromInput(
  text: string,
  emptyMessage: string,
): { doc?: unknown; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return { error: emptyMessage };
  if (/^https?:\/\//.test(trimmed)) {
    const scanned = decodeScanned(trimmed);
    return scanned.ok
      ? { doc: scanned.document }
      : {
          error: `Payload problem: ${stated(scanned.error.kind, scanned.error.detail)}`,
        };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { error: `Not valid JSON: ${(e as Error).message}` };
  }
  // The envelope gate before the schema: a value that is not a document has
  // nothing for a field-by-field report to describe.
  const envelope = checkEnvelope(parsed);
  return envelope.ok
    ? { doc: envelope.document }
    : {
        error: `Envelope problem: ${stated(envelope.error.kind, envelope.error.detail)}`,
      };
}
