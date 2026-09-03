#!/usr/bin/env node
// fixtures/README.md ⟷ the fixture directories. The tables are the only prose
// saying WHY each fixture exists, and hand-written; this buys the guarantee a
// generator would have. The reason lives in the README rather than a `$comment`
// member, which would fail the authoring schema.

/** The backticked filenames in a section's table rows, in order. */
function rowFiles(section) {
  const files = [];
  for (const line of section.split("\n")) {
    if (!/^\| \S/.test(line) || /^\| -+ /.test(line)) continue;
    const m = line.match(/^\| `([^`]+\.json)`/);
    if (m) files.push(m[1]);
  }
  return files;
}

/** Slice to one `## <title>` section, up to the next heading of any level. */
function sectionOf(md, title) {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && /^#{1,6} /.test(l));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
}

/**
 * @param readmeMd  fixtures/README.md content
 * @param dirs      { valid: string[], invalid: string[] } — filenames, no path
 * @returns [{ label, error }] — error null on pass
 */
export function catalogFindings(readmeMd, dirs) {
  const findings = [];
  const add = (label, error) => findings.push({ label, error: error ?? null });

  for (const name of ["valid", "invalid"]) {
    const section = sectionOf(readmeMd, `${name}/`);
    if (!section) {
      add(
        `${name}/ table`,
        `section "## ${name}/" not found — re-point the extractor`,
      );
      continue;
    }
    const rows = rowFiles(section);
    const files = dirs[name];
    if (!rows.length) {
      add(`${name}/ table`, "no fixture rows extracted");
      continue;
    }

    const undocumented = files.filter((f) => !rows.includes(f));
    const phantom = rows.filter((r) => !files.includes(r));
    const duplicated = rows.filter((r, i) => rows.indexOf(r) !== i);

    const problems = [];
    if (undocumented.length)
      problems.push(
        `in ${name}/ but not in the table: ${undocumented.join(", ")}`,
      );
    if (phantom.length)
      problems.push(`in the table but not in ${name}/: ${phantom.join(", ")}`);
    if (duplicated.length)
      problems.push(`listed twice: ${[...new Set(duplicated)].join(", ")}`);
    add(`${name}/ table`, problems.length ? problems.join("; ") : null);
  }

  return findings;
}
