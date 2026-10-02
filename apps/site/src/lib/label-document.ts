import type { CoffeeJSONDocument } from "@coffeejson/core";

export interface LabelDocument {
  /** The document the printed code carries. */
  doc: CoffeeJSONDocument;
  /** What the page's document states and the code does not, as member names. */
  leftOut: string[];
}

// The members a label already prints in words. Repeating them makes the code
// denser and tells an application nothing new.
const PROSE = ["description", "roaster_notes"] as const;

/**
 * The document a code printed on a bag carries: the page's first bean without
 * the prose a label already prints, its `roast_date` set to the batch the sheet
 * is for, and every recipe. `roastDate: null` is a sheet reused from one batch
 * to the next, which states no date at all. Returns `null` when the document
 * has no bean, because a label describes a coffee. Never mutates its input.
 */
export function labelDocument(
  doc: CoffeeJSONDocument,
  opts: { roastDate: string | null },
): LabelDocument | null {
  const first = doc.beans?.[0];
  if (!first) return null;
  const leftOut: string[] = [];
  const bean = structuredClone(first) as Record<string, unknown>;
  for (const key of PROSE) {
    if (key in bean) {
      delete bean[key];
      leftOut.push(key);
    }
  }
  if (opts.roastDate === null) {
    if ("roast_date" in bean) {
      delete bean["roast_date"];
      leftOut.push("roast_date");
    }
  } else {
    bean["roast_date"] = opts.roastDate;
  }
  const extra = (doc.beans?.length ?? 0) - 1;
  if (extra > 0) leftOut.push(`${extra} more bean${extra === 1 ? "" : "s"}`);
  const out = structuredClone(doc) as CoffeeJSONDocument;
  out.beans = [bean as NonNullable<CoffeeJSONDocument["beans"]>[number]];
  return { doc: out, leftOut };
}
