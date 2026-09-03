#!/usr/bin/env node
// Every registry stays internally consistent, every slug the spec's seed tables
// show exists in the data, the token registries equal the prose lists they
// mirror, and the repo's own documents stay on-registry — a corpus gear id is a
// canonical slug or "custom", never an alias, which is a synonym a third-party
// producer may emit. Corpus varietals are NOT checked: transcriptions carry the
// roaster's claim verbatim.

const GEAR_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CATEGORIES = new Set(["dripper", "immersion", "stovetop", "espresso-machine", "basket", "grinder"]);
// What kind of name a varietal entry carries. Both members are optional: a row
// whose parentage is genuinely disputed omits the key rather than guessing, and a
// forced guess is worse data than a stated gap. `in` rather than `!== undefined`,
// because a present-but-null member is the thing the null rule forbids — and
// `SPECIES_EPITHET.test(null)` would otherwise pass, null stringifying to "null".
const VARIETAL_KINDS = new Set([
  "cultivar", "group", "landrace", "species", "botanical_variety",
  "interspecific_hybrid", "f1_hybrid",
]);
// The botanical epithet the name is sold as; `a-x-b` for a true interspecific cross.
const SPECIES_EPITHET = /^[a-z]+(-x-[a-z]+)?$/;

/** Backticked kebab slugs inside a section's table rows (the Gear registry
 *  seed table in docs/spec/06-vocabularies.md). */
function seedSlugs(section) {
  const slugs = [];
  for (const line of section.split("\n")) {
    if (!/^\| \S/.test(line) || /^\| -+ /.test(line)) continue;
    for (const m of line.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)) slugs.push(m[1]);
  }
  return slugs;
}

/** The canonical-examples paragraph's backticked names, e.g. `Bourbon`. */
function canonicalExamples(section) {
  const start = section.indexOf("Canonical examples:");
  if (start === -1) return [];
  const para = section.slice(start, section.indexOf("\n\n", start));
  return [...para.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** The recommended-values line of an open-registry section: backticked tokens
 *  joined by " · " and nothing else. */
function recommendedTokens(section) {
  const lines = section.split("\n").filter((l) => /^`[^`]+`( · `[^`]+`)+$/.test(l.trim()));
  if (lines.length !== 1) return null;
  return [...lines[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

/** Alias-table rows as {aliases, canonical} (col2's first backticked token). */
function aliasRows(section) {
  const rows = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^\| (`.+?`(?:, `.+?`)*) \| (`[^`]+`)/);
    if (!m) continue;
    const canonical = m[2].replaceAll("`", "");
    const aliases = [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]).filter((a) => a !== canonical);
    rows.push({ aliases, canonical });
  }
  return rows;
}

/** Every gear id a document's recipes reference (brewer, basket, grinder). */
export function gearIdsInDocument(doc) {
  const ids = [];
  for (const recipe of doc.recipes ?? []) {
    for (const gear of [recipe.brewer, recipe.basket, recipe.grind?.grinder]) {
      if (gear && typeof gear.id === "string") ids.push(gear.id);
    }
  }
  return ids;
}

/**
 * Run every registry check.
 * @param gearRegistry      parsed registries/gear.json
 * @param varietalRegistry  parsed registries/varietals.json
 * @param vocabulariesMd    docs/spec/06-vocabularies.md content
 * @param documents         [{label, doc}] — the repo's own valid documents
 * @param tokenRegistries   [{file, key, section}] — a registry that mirrors a prose list
 * @returns [{ label, error }] — error null on pass
 */
export function registryFindings(gearRegistry, varietalRegistry, vocabulariesMd, documents, tokenRegistries = []) {
  const findings = [];
  const add = (label, error) => findings.push({ label, error: error ?? null });

  const gear = gearRegistry.gear ?? [];
  const gearIds = new Set();
  const gearAliases = new Set();
  for (const entry of gear) {
    const problems = [];
    if (!GEAR_ID.test(entry.id ?? "")) problems.push("id is not a kebab-case slug");
    if (entry.id === "custom") problems.push('"custom" is the reserved escape hatch, never a registry entry');
    if (gearIds.has(entry.id) || gearAliases.has(entry.id)) problems.push("duplicate id");
    if (!entry.label) problems.push("label is required — it is the display fallback the spec names");
    if (!CATEGORIES.has(entry.category)) problems.push(`unknown category "${entry.category}"`);
    gearIds.add(entry.id);
    for (const alias of entry.aliases ?? []) {
      if (!GEAR_ID.test(alias)) problems.push(`alias "${alias}" is not a kebab-case slug`);
      if (alias === "custom") problems.push('"custom" is the reserved escape hatch, never a registry alias');
      if (alias === entry.id) problems.push(`alias "${alias}" duplicates its canonical id`);
      if (gearIds.has(alias) || gearAliases.has(alias)) problems.push(`duplicate alias "${alias}"`);
      gearAliases.add(alias);
    }
    add(`gear ${entry.id ?? "<no id>"}`, problems.length ? problems.join("; ") : null);
  }

  const varietals = varietalRegistry.varietals ?? [];
  const names = new Set();
  const allAliases = new Set();
  for (const entry of varietals) {
    const problems = [];
    if (!entry.name) problems.push("name is required");
    if (names.has(entry.name)) problems.push("duplicate name");
    names.add(entry.name);
    if ("kind" in entry && !VARIETAL_KINDS.has(entry.kind))
      problems.push(`unknown kind "${entry.kind}" — one of ${[...VARIETAL_KINDS].join(", ")}, or omit the key`);
    if ("species" in entry && !(typeof entry.species === "string" && SPECIES_EPITHET.test(entry.species)))
      problems.push(`species "${entry.species}" is not a lowercase epithet — or omit the key`);
    for (const alias of entry.aliases ?? []) {
      if (alias === entry.name) problems.push(`alias "${alias}" duplicates its canonical name`);
      if (allAliases.has(alias)) problems.push(`alias "${alias}" appears twice`);
      allAliases.add(alias);
    }
    add(`varietal ${entry.name ?? "<no name>"}`, problems.length ? problems.join("; ") : null);
  }
  const collisions = [...allAliases].filter((a) => names.has(a));
  add("varietal aliases distinct from canonical names",
    collisions.length ? `alias and canonical at once: ${collisions.join(", ")}` : null);

  // The spec's examples must exist in the data.
  const sectionOf = (title) => {
    const lines = vocabulariesMd.split("\n");
    const start = lines.findIndex((l) => l.replaceAll("`", "").trim() === `### ${title}`);
    if (start === -1) return null;
    const end = lines.findIndex((l, i) => i > start && /^#{1,3} /.test(l));
    return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
  };

  const gearSection = sectionOf("Gear registry");
  if (!gearSection) add("prose gear seeds", 'section "Gear registry" not found — re-point the extractor');
  else {
    const seeds = seedSlugs(gearSection);
    if (!seeds.length) add("prose gear seeds", "no seed slugs extracted");
    else {
      const missing = seeds.filter((s) => !gearIds.has(s));
      add("prose gear seeds", missing.length ? `named in the spec but not in gear.json: ${missing.join(", ")}` : null);
    }
  }

  const varietalSection = sectionOf("Varietal registry");
  if (!varietalSection) add("prose varietal examples", 'section "Varietal registry" not found — re-point the extractor');
  else {
    const canon = canonicalExamples(varietalSection);
    if (!canon.length) add("prose varietal examples", "no canonical examples extracted");
    else {
      const missing = canon.filter((n) => !names.has(n));
      add("prose varietal examples", missing.length ? `named in the spec but not in varietals.json: ${missing.join(", ")}` : null);
    }
    for (const { aliases, canonical } of aliasRows(varietalSection)) {
      const entry = varietals.find((v) => v.name === canonical);
      const missing = entry ? aliases.filter((a) => !(entry.aliases ?? []).includes(a)) : aliases;
      add(`prose alias ${canonical}`,
        !entry ? `canonical "${canonical}" not in varietals.json`
          : missing.length ? `aliases the spec shows but the data lacks: ${missing.join(", ")}` : null);
    }
  }

  // A token registry is the prose list as data: same tokens, same order, or one
  // of the two is stale and a consumer syncing the file gets a different answer
  // than a consumer reading the chapter.
  for (const { file, key, section, data } of tokenRegistries) {
    const prose = sectionOf(section);
    const tokens = data?.[key];
    const problems = [];
    if (!Array.isArray(tokens)) problems.push(`${file} states no "${key}" array`);
    if (!prose) problems.push(`section "${section}" not found — re-point the extractor`);
    else {
      const recommended = recommendedTokens(prose);
      if (!recommended) problems.push(`no single recommended-values line in "${section}"`);
      else if (Array.isArray(tokens) && recommended.join(" ") !== tokens.join(" "))
        problems.push(`prose lists ${recommended.join(", ")}; ${file} holds ${tokens.join(", ")}`);
    }
    add(`registry parity ${file}`, problems.length ? problems.join("; ") : null);
  }

  // This repo's own documents stay on-registry.
  for (const { label, doc } of documents) {
    const offRegistry = gearIdsInDocument(doc).filter((id) => id !== "custom" && !gearIds.has(id));
    add(`document gear ${label}`,
      offRegistry.length
        ? `non-canonical gear id(s): ${offRegistry.join(", ")} — use the canonical slug, register a new one, or use "custom"`
        : null);
  }

  return findings;
}
