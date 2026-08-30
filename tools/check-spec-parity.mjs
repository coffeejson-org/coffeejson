#!/usr/bin/env node
// Schema ↔ prose parity: every object's field table names exactly the schema's
// properties (agreeing on bare requiredness), and every controlled vocabulary
// lists exactly the schema's values. NOT checked: descriptions, conditional
// requiredness, link targets. A missing section or table is a loud error, never a
// silent skip, so a heading rename fails the build.

/** Slice a markdown document to one section: from its heading line to the
 *  next heading of the same or higher level. Heading match ignores backticks. */
function sectionOf(md, level, title) {
  const lines = md.split("\n");
  const hashes = "#".repeat(level);
  const clean = (s) => s.replaceAll("`", "").trim();
  const start = lines.findIndex(
    (l) => l.startsWith(`${hashes} `) && clean(l.slice(level + 1)) === clean(title),
  );
  if (start === -1) return null;
  const isBoundary = (l) => /^#{1,6} /.test(l) && l.indexOf(" ") <= level;
  const end = lines.findIndex((l, i) => i > start && isBoundary(l));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
}

/** Drop everything from a section's first deeper sub-heading onward. An
 *  object whose prose has sub-sections (a Tasting's `perceived` and `measured`
 *  each own a table) would otherwise have their rows read as its own fields. */
function beforeSubsections(section, level) {
  const lines = section.split("\n");
  const cut = lines.findIndex((l) => new RegExp(`^#{${level + 1},6} `).test(l));
  return cut === -1 ? section : lines.slice(0, cut).join("\n");
}

/** Rows of a `| Field | Type | Req? | Notes |` table: [{name, type, req}]. */
function fieldTableRows(section) {
  const rows = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^\| `([^`]+)` \| (.+?) \| (.+?) \|/);
    if (m) rows.push({ name: m[1], type: m[2].trim(), req: m[3].trim() });
  }
  return rows;
}

/** The JSON base type a prose Type cell claims, or null when the phrasing
 *  isn't one this check understands (unknown phrasings never false-fail). */
function proseBaseType(cell) {
  const t = cell.toLowerCase();
  if (t.startsWith("array")) return "array";
  if (t.startsWith("[") || t.startsWith("object")) return "object"; // linked sub-object
  if (t.startsWith("string")) return "string";
  if (t.startsWith("number")) return "number";
  if (t.startsWith("boolean")) return "boolean";
  return null;
}

/** The JSON base type a schema property declares — through one `$ref` hop —
 *  or null (anyOf shapes and untyped properties are skipped, not judged). */
function schemaBaseType(prop, defs) {
  if (!prop) return null;
  if (prop.$ref) {
    const def = defs[prop.$ref.replace("#/$defs/", "")];
    return def?.type ?? null;
  }
  return typeof prop.type === "string" ? prop.type : null;
}

/** First-column backticked values of a `| Value | Meaning |`-style table. */
function valueTableValues(section) {
  const values = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^\| `([^`]+)` \|/);
    if (m) values.push(m[1]);
  }
  return values;
}

/** Values of an inline dot-separated list (possibly wrapped across lines):
 *  `a` · `b` · `c`. Only lines consisting solely of such tokens count. */
function dotListValues(section) {
  const values = [];
  for (const line of section.split("\n")) {
    if (/^\s*(`[a-z0-9_]+`\s*(·\s*)?)+$/.test(line)) {
      for (const m of line.matchAll(/`([a-z0-9_]+)`/g)) values.push(m[1]);
    }
  }
  return values;
}

const setDiff = (a, b) => [...a].filter((x) => !b.has(x));

/** Compare two value sets; returns an error string or null. */
function compareSets(kind, prose, schema) {
  const proseSet = new Set(prose);
  const schemaSet = new Set(schema);
  const missing = setDiff(schemaSet, proseSet);
  const extra = setDiff(proseSet, schemaSet);
  if (!missing.length && !extra.length) return null;
  const parts = [];
  if (missing.length) parts.push(`in schema but not prose: ${missing.join(", ")}`);
  if (extra.length) parts.push(`in prose but not schema: ${extra.join(", ")}`);
  return `${kind} — ${parts.join("; ")}`;
}

/**
 * Run every parity check.
 * @param schema  parsed docs/schema/coffeejson-1.0.schema.json
 * @param docs    { envelope, recipe, bean, tasting, vocabularies } markdown strings
 * @returns [{ label, error }] — error null on pass
 */
export function parityFindings(schema, docs) {
  const findings = [];
  const add = (label, error) => findings.push({ label, error: error ?? null });
  const defs = schema.$defs;

  const objects = [
    { label: "envelope", md: docs.envelope, level: 2, section: "Fields", props: schema.properties, required: schema.required },
    { label: "recipe", md: docs.recipe, level: 2, section: "Fields", props: defs.recipe.properties, required: defs.recipe.required },
    { label: "gear", md: docs.recipe, level: 2, section: "Gear object", props: defs.gear.properties, required: defs.gear.required },
    { label: "grind", md: docs.recipe, level: 2, section: "Grind object", props: defs.grind.properties, required: defs.grind.required },
    { label: "step", md: docs.recipe, level: 2, section: "Step object", props: defs.step.properties, required: defs.step.required },
    { label: "addition", md: docs.recipe, level: 2, section: "Addition object", props: defs.addition.properties, required: defs.addition.required },
    { label: "party", md: docs.recipe, level: 2, section: "Party object", props: defs.party.properties, required: defs.party.required },
    { label: "tasting", md: docs.tasting, level: 2, section: "Fields", props: defs.tasting.properties, required: defs.tasting.required },
    { label: "measured", md: docs.tasting, level: 2, section: "Measured", props: defs.tasting.properties.measured.properties, required: defs.tasting.properties.measured.required },
    { label: "bean", md: docs.bean, level: 2, section: "Fields", props: defs.bean.properties, required: defs.bean.required },
    { label: "origin", md: docs.bean, level: 2, section: "Origin object", props: defs.origin.properties, required: defs.origin.required },
    { label: "originItem", md: docs.bean, level: 2, section: "OriginItem object", props: defs.originItem.properties, required: defs.originItem.required },
    { label: "altitude", md: docs.bean, level: 2, section: "Altitude object", props: defs.altitude.properties, required: defs.altitude.required },
  ];
  for (const { label, md, level, section, props, required, ownTableOnly } of objects) {
    const found = sectionOf(md, level, section);
    if (found === null) {
      add(`fields ${label}`, `section "${section}" not found — re-point the extractor`);
      continue;
    }
    const sec = ownTableOnly ? beforeSubsections(found, level) : found;
    const rows = fieldTableRows(sec);
    if (!rows.length) {
      add(`fields ${label}`, `no field table found in section "${section}"`);
      continue;
    }
    add(`fields ${label}`, compareSets("field set", rows.map((r) => r.name), Object.keys(props)));
    // Bare yes/no requiredness only; footnoted or conditional marks are the
    // prose's business (the basis switch, altitude's one-of).
    const requiredSet = new Set(required ?? []);
    for (const { name, req } of rows) {
      if (req === "yes" && !requiredSet.has(name))
        add(`required ${label}.${name}`, "prose says required, schema does not");
      else if (req === "no" && requiredSet.has(name))
        add(`required ${label}.${name}`, "schema says required, prose says optional");
      else add(`required ${label}.${name}`, null);
    }
    // The Type column is what an adopter transcribes into their own types, and
    // where drift lands (a field typed `string` after the schema made it an
    // array). Base JSON types only; unreadable phrasings are skipped, not judged.
    for (const { name, type } of rows) {
      const prose = proseBaseType(type);
      const schemaType = schemaBaseType(props[name], defs);
      if (prose === null || schemaType === null) continue;
      add(
        `type ${label}.${name}`,
        prose === schemaType ? null : `prose Type cell says ${prose}, schema says ${schemaType}`,
      );
    }
  }

  // The perceived axes name themselves in a scale table (-1 / 0 / +1), not a
  // field table, so the field-set check reads their first column instead.
  const perceivedSec = sectionOf(docs.tasting, 2, "Perceived");
  if (!perceivedSec) add("fields perceived", 'section "Perceived" not found — re-point the extractor');
  else
    add(
      "fields perceived",
      compareSets("field set", valueTableValues(perceivedSec), Object.keys(defs.tasting.properties.perceived.properties)),
    );

  // Measurement: three schema defs share one prose table.
  const measurementSec = sectionOf(docs.recipe, 2, "Measurement object");
  if (!measurementSec) add("fields measurement", 'section "Measurement object" not found');
  else {
    const names = fieldTableRows(measurementSec).map((r) => r.name);
    for (const def of ["massMeasurement", "waterMeasurement", "tempMeasurement", "pressureMeasurement"])
      add(`fields ${def}`, compareSets("field set", names, Object.keys(defs[def].properties)));
  }

  const vocab = (level, title, extract, schemaValues, subsetOnly = false) => {
    const sec = sectionOf(docs.vocabularies, level, title);
    if (!sec) return add(`vocab ${title}`, `section "${title}" not found — re-point the extractor`);
    const values = extract(sec);
    if (!values.length) return add(`vocab ${title}`, `no values extracted from section "${title}"`);
    if (subsetOnly) {
      const present = new Set(values);
      const missing = schemaValues.filter((v) => !present.has(v));
      return add(`vocab ${title}`, missing.length ? `schema values not named in prose: ${missing.join(", ")}` : null);
    }
    add(`vocab ${title}`, compareSets("value set", values, schemaValues));
  };

  vocab(3, "`method`", valueTableValues, defs.method.enum);
  vocab(3, "`basis`", valueTableValues, defs.recipe.properties.basis.enum);
  vocab(3, "Step `kind`", valueTableValues, defs.step.properties.kind.enum);
  vocab(3, "Grind `size`", dotListValues, defs.grind.properties.size.enum);
  vocab(3, "`process`", valueTableValues, defs.process.enum);
  vocab(3, "`roast_level`", dotListValues, defs.bean.properties.roast_level.enum);
  vocab(3, "`form`", valueTableValues, defs.bean.properties.form.enum);
  vocab(3, "`preferred_extraction`", valueTableValues, defs.bean.properties.preferred_extraction.enum);
  vocab(3, "`origin.type`", dotListValues, defs.origin.properties.type.enum);
  // Party `type` names its two values in prose sentences, not a table — the
  // schema's values must at least all appear in the section.
  vocab(3, "Party `type`", (sec) => [...sec.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]), defs.party.properties.type.enum, true);
  // Addition `type` is an open registry: the schema's `examples` and the
  // prose's recommended list must agree exactly.
  vocab(3, "Addition `type`", dotListValues, defs.addition.properties.type.examples);

  // Units: the one prose table covers every measurement def's enum.
  const unitsSec = sectionOf(docs.vocabularies, 3, "Units");
  if (!unitsSec) add("vocab units", 'section "Units" not found');
  else {
    const proseUnits = [];
    for (const line of unitsSec.split("\n")) {
      const m = line.match(/^\| \S.*? \| `([^`]+)` \|/);
      if (m) proseUnits.push(m[1]);
    }
    const schemaUnits = [
      ...defs.massMeasurement.properties.unit.enum,
      ...defs.waterMeasurement.properties.unit.enum,
      ...defs.tempMeasurement.properties.unit.enum,
      ...defs.pressureMeasurement.properties.unit.enum,
      ...defs.altitude.properties.unit.enum,
    ];
    add("vocab units", compareSets("unit set", proseUnits, schemaUnits));
  }

  return findings;
}
