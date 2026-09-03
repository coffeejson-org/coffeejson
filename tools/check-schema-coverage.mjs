#!/usr/bin/env node
// JSON decoding skips keys a type does not name, so a field can land in the
// schema and reach no reader with every test green. Matches PER TYPE: a global
// text match would pass `originItem.name` because `Party` declares a `name`. A
// coverage check — it proves a key is named on the right type, not mapped.

// A $def missing here is REPORTED, not skipped, so a new one must be mapped
// deliberately. Measurement defs share one type on purpose.
export const OWNER = {
  document: { ts: ["CoffeeJSONDocument"], swift: ["Document"] },
  // TypeScript calls it `DocumentGenerator`, because `Generator` shadows its own
  // built-in; Swift, with no such clash, calls it `Generator`. The wire member is
  // `generator` in both. Only the name each stack actually declares is listed —
  // a second accepted spelling would let the check pass on a type that is gone.
  "document.generator": { ts: ["DocumentGenerator"], swift: ["Generator"] },
  "bean.rest_days": { ts: ["RestWindow"], swift: ["RestDays"] },
  recipe: { ts: ["Recipe"], swift: ["Recipe"] },
  bean: { ts: ["Bean"], swift: ["Bean"] },
  tasting: { ts: ["Tasting"], swift: ["Tasting"] },
  "tasting.perceived": { ts: ["PerceivedAxes"], swift: ["PerceivedAxes"] },
  "tasting.measured": { ts: ["MeasuredCup"], swift: ["MeasuredCup"] },
  step: { ts: ["Step"], swift: ["Step"] },
  grind: { ts: ["Grind"], swift: ["Grind"] },
  gear: { ts: ["GearRef"], swift: ["Gear"] },
  filter: { ts: ["Filter"], swift: ["Filter"] },
  addition: { ts: ["Addition"], swift: ["Addition"] },
  party: { ts: ["Party"], swift: ["Party"] },
  origin: { ts: ["Origin"], swift: ["Origin"] },
  originItem: { ts: ["OriginItem"], swift: ["OriginItem"] },
  altitude: { ts: ["Measurement"], swift: ["Altitude", "Quantity"] },
  massMeasurement: { ts: ["Measurement"], swift: ["Quantity"] },
  waterMeasurement: { ts: ["Measurement"], swift: ["Quantity"] },
  tempMeasurement: { ts: ["Measurement"], swift: ["Quantity"] },
  pressureMeasurement: { ts: ["Measurement"], swift: ["Quantity"] },
  recipeLocalization: {
    ts: ["RecipeLocalization"],
    swift: ["RecipeLocalization"],
  },
  beanLocalization: { ts: ["BeanLocalization"], swift: ["BeanLocalization"] },
  stepLocalization: { ts: ["StepLocalization"], swift: ["StepLocalization"] },
};

/** Every wire key the schema declares, as `<owning $def>.<key>`. */
export function wireKeys(schema) {
  const keys = new Set();
  const walk = (node, owner) => {
    if (!node || typeof node !== "object") return;
    if (node.properties)
      for (const k of Object.keys(node.properties)) {
        keys.add(`${owner}.${k}`);
        // An inline object declares its own scope: without this, `generator`'s
        // members would read as the document's, on the wrong type.
        const sub = node.properties[k];
        const nested =
          sub &&
          typeof sub === "object" &&
          (sub.properties || sub.items?.properties);
        walk(sub, nested ? `${owner}.${k}` : owner);
      }
    if (node.items) walk(node.items, owner);
    // A key appearing only inside a `then` is still one an implementation reads.
    for (const kw of ["allOf", "anyOf", "oneOf"])
      if (node[kw])
        node[kw].forEach((n) => {
          walk(n, owner);
        });
    for (const kw of ["if", "then", "else"])
      if (node[kw]) walk(node[kw], owner);
    if (node.$defs)
      for (const k of Object.keys(node.$defs)) walk(node.$defs[k], k);
  };
  walk(schema, "document");
  return keys;
}

/** The body of a named type, brace-matched from its declaration. Nested braces
 *  belong to the body — an inline object literal in a TS interface is part of
 *  the type that declares it, which is how `Bean.origin.items[]` is reached. */
function body(source, re) {
  const m = re.exec(source);
  if (!m) return null;
  const open = source.indexOf("{", m.index);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0)
      return source.slice(open, i + 1);
  }
  return null;
}

const camel = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const READS = {
  ts: (source, name, key) => {
    const b = body(source, new RegExp(`export (?:interface|type) ${name}\\b`));
    return !!b && new RegExp(`(^|[\\s{;])${key}\\??\\s*:`, "m").test(b);
  },
  // `public` is load-bearing: every wire property is public and no local binding
  // is, so a `let name` inside a custom `init(from:)` cannot count.
  swift: (source, name, key) => {
    const b = body(
      source,
      new RegExp(`(?:struct|enum|final class) ${name}\\b`),
    );
    return (
      !!b &&
      (b.includes(`"${key}"`) ||
        new RegExp(`\\bpublic (?:var|let) ${camel(key)}\\b`).test(b))
    );
  },
};

/**
 * @param schema   parsed docs/schema/coffeejson-1.0.schema.json
 * @param sources  { ts?: string, swift?: string } — concatenated source text
 *                 per stack. A stack absent here is not checked, so a repo that
 *                 holds only one implementation checks only that one.
 * @returns [{ label, error }] — error null on pass
 */
export function coverageFindings(schema, sources) {
  const findings = [];
  const stacks = Object.keys(READS).filter(
    (s) => typeof sources[s] === "string",
  );
  const gaps = Object.fromEntries(stacks.map((s) => [s, []]));
  const unmapped = [];

  for (const key of [...wireKeys(schema)].sort()) {
    const cut = key.lastIndexOf(".");
    const [def, bare] = [key.slice(0, cut), key.slice(cut + 1)];
    const owner = OWNER[def];
    if (!owner) {
      unmapped.push(key);
      continue;
    }
    for (const stack of stacks)
      if (
        !owner[stack].some((name) => READS[stack](sources[stack], name, bare))
      )
        gaps[stack].push(key);
  }

  for (const stack of stacks)
    findings.push({
      label: `${stack} names every schema key`,
      error: gaps[stack].length
        ? `${gaps[stack].length} unnamed: ${gaps[stack].join(", ")}`
        : null,
    });
  findings.push({
    label: "every $def is mapped to a type",
    error: unmapped.length ? `unmapped $def(s): ${unmapped.join(", ")}` : null,
  });
  return findings;
}
