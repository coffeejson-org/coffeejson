#!/usr/bin/env node
// The neutral display label for every gear id, generated from registries/gear.json
// into the package that has to render one.
//
// `id` is the wire form (01-overview.md, principle 2: locale-neutral on the wire,
// localized at the edges), so a document with a known id carries no display string
// and a consumer that cannot resolve the id has nothing to show but the slug. Core
// is the reference consumer, so it ships the registry's own neutral labels; a
// consumer with localized strings passes its own map to gearLabel and overrides them.
//
// Aliases resolve to the same label as their canonical id — that is what an alias is.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function renderGearLabels(gear) {
  const rows = [];
  for (const e of gear) {
    rows.push([e.id, e.label]);
    for (const a of e.aliases ?? []) rows.push([a, e.label]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const body = rows
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");
  const out = `// GENERATED from registries/gear.json by tools/gen-gear-labels.mjs — do not edit by hand.
//
// The registry's label for every gear id and alias. \`gearLabel\` resolves a known id
// through this map, because a document that names registered gear carries no display
// string of its own: the id is the wire form and the label is the edge (01-overview.md,
// principle 2).
//
// Keyed by language tag, and \`en\` is the only one the registry can supply today —
// \`gear.json\` carries one \`label\` per entry. Adding \`ja\` is then a DATA change and
// not a reshape: give the registry a per-entry \`label_i18n\` and this generator emits
// the extra blocks beside \`en\`. Until then \`gearLabelsFor\` falls back to \`en\`, which
// is right rather than merely convenient: most of these strings are brand and model
// names that do not translate.

export const GEAR_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
  en: Object.freeze({
${body}
  }),
});

/** The registry's labels for a document's \`lang\`, falling back to \`en\`. */
export function gearLabelsFor(lang?: string): Readonly<Record<string, string>> {
  if (typeof lang === "string") {
    const exact = GEAR_LABELS[lang];
    if (exact) return exact;
    // A tag narrows: \`ja-JP\` takes \`ja\` before it takes \`en\`.
    const base = GEAR_LABELS[lang.split("-")[0] ?? ""];
    if (base) return base;
  }
  return GEAR_LABELS["en"]!;
}
`;
  return { out, count: rows.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { gear } = JSON.parse(
    readFileSync(join(root, "registries/gear.json"), "utf8"),
  );
  const { out, count } = renderGearLabels(gear);
  writeFileSync(join(root, "packages/core/src/gear-labels.ts"), out);
  console.log(
    `wrote packages/core/src/gear-labels.ts — ${count} ids and aliases`,
  );
}
