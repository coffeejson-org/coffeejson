import { roastMark } from "./roast-mark.mjs";
import { esc } from "./text.mjs";

/** What the bags are, said the same way wherever they are listed. */
export const BAGS_INTRO = `Every coffee in the corpus as an identity of its own — one page per bag,
  whether one published source describes it or three. Each names and links the
  source it was transcribed from.`;

/** What a bag's line of the index is drawn from. */
export interface BagRow {
  slug: string;
  name: string;
  roaster: { name: string };
  origins: string[];
  process: string;
  roast: string;
  roastLevel: string | null;
  recipes: unknown[];
}

// A bag is one line of an index, not a card: there are dozens, each a name and
// three facts, and a wall of boxes holding one sentence apiece says less than a
// list a reader can run an eye down.
// Fixed columns: origin, process, roast, brews. Each fact has one place.
const row = (b: BagRow): string => `
      <li>
        <a class="index-link" href="/beans/${esc(b.slug)}/">${esc(b.name)}</a>
        <ul class="origins">${b.origins.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>
        <span>${esc(b.process)}</span>
        <span>${roastMark(b.roastLevel)} ${esc(b.roast)}</span>
        <span class="num muted">${
          b.recipes.length
            ? `${b.recipes.length} brew${b.recipes.length === 1 ? "" : "s"}`
            : ""
        }</span>
      </li>`;

/**
 * Bags as the site lists them, wherever it does: one section per roaster, in
 * name order, a line per bag. Both the bags hub and the directory's bag lens
 * call this, so the same data is never drawn two ways.
 */
export function bagSections(bags: BagRow[]): string {
  const groups = new Map<string, BagRow[]>();
  for (const b of bags)
    groups.set(b.roaster.name, [...(groups.get(b.roaster.name) ?? []), b]);
  return [...groups]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([roaster, rows]) => `
    <section class="group">
      <h2>${esc(roaster)} <span class="num muted">${rows.length}</span></h2>
      <ul class="index">${rows.map(row).join("")}</ul>
    </section>`,
    )
    .join("");
}
