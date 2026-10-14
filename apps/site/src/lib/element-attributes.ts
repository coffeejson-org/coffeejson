import { esc } from "./text.mjs";

export interface AttributeRow {
  name: string;
  /** The description as HTML: escaped text, with code spans as `<code>`. */
  html: string;
}

const HEADING = "## The `<coffee-json>` element";

// A cell may hold text and code spans and nothing else. Anything richer would
// reach the page as literal asterisks or brackets, so it fails the build instead.
const inline = (cell: string): string => {
  const parts = cell.split("`");
  if (parts.length % 2 === 0) throw new Error(`unbalanced code span: ${cell}`);
  return parts
    .map((p, i) => {
      if (i % 2) return `<code>${esc(p)}</code>`;
      if (/[*_[\]]/.test(p))
        throw new Error(`markdown the page cannot render: ${p}`);
      return esc(p);
    })
    .join("");
};

/** The attribute table under the element's heading in core's README. Throws on
 *  a missing heading or table, so the page never ships without its table. */
export function elementAttributes(readme: string): AttributeRow[] {
  const start = readme.indexOf(HEADING);
  if (start === -1) throw new Error(`README has no "${HEADING}" section`);
  const next = readme.indexOf("\n## ", start + HEADING.length);
  const section = readme.slice(start, next === -1 ? undefined : next);
  const lines = section.split("\n");
  const head = lines.findIndex((l) => /^\|\s*Attribute\s*\|/.test(l));
  if (head === -1)
    throw new Error("the element section has no attribute table");
  const rows: AttributeRow[] = [];
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith("|")) break;
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((c) => c.trim());
    const [name, description] = cells;
    const bare = /^`([a-z-]+)`$/.exec(name ?? "");
    if (!bare || description === undefined)
      throw new Error(`not an attribute row: ${line}`);
    rows.push({ name: bare[1]!, html: inline(description) });
  }
  if (!rows.length) throw new Error("the attribute table has no rows");
  return rows;
}
