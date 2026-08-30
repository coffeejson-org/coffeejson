import { expect, test } from "vitest";
import { defaultLabels, mergeLabels } from "../src/labels";
import { methodLabel, vocabularyLabel } from "../src/format";
import { DECODE_ERROR_KINDS } from "../src/codec";
import {
  BEAN_FORMS, BREW_METHODS, FILTER_MATERIALS, GRIND_SIZES, PROCESSES, ROAST_LEVELS, STEP_KINDS,
} from "../src/vocabularies";

test("mergeLabels() with no overrides is the English defaults", () => {
  expect(mergeLabels()).toEqual(defaultLabels);
  expect(defaultLabels.facts.dose).toBe("Dose");
  expect(defaultLabels.badge).toBe("Recommended");
});
test("overrides deep-merge; unspecified keys keep defaults (consumer re-wording)", () => {
  const l = mergeLabels({ facts: { dose: "Coffee", waterTemp: "Temperature" } });
  expect(l.facts.dose).toBe("Coffee");
  expect(l.facts.waterTemp).toBe("Temperature");
  expect(l.facts.ratio).toBe("Ratio");            // untouched
  expect(l.badge).toBe("Recommended");            // untouched
});
test("methods merge by slug without dropping the default table", () => {
  const l = mergeLabels({ methods: { pour_over: "Filter" } });
  expect(l.methods.pour_over).toBe("Filter");
  expect(l.methods.espresso).toBe("Espresso");    // default kept
});

test("addition labels default to English and merge key-by-key", () => {
  expect(defaultLabels.facts.additions).toBe("Additions");
  expect(defaultLabels.additionKinds).toEqual({ ice: "Ice", other: "Other" });
  const merged = mergeLabels({ additionKinds: { ice: "氷" } });
  expect(merged.additionKinds.ice).toBe("氷");
  expect(merged.additionKinds.other).toBe("Other");   // untouched default kept
});

test("brew labels merge key-by-key over the defaults", () => {
  const merged = mergeLabels({ brew: { pause: "Anhalten", reset: "Neu starten" } });
  expect(merged.brew.pause).toBe("Anhalten");
  expect(merged.brew.reset).toBe("Neu starten");
  expect(merged.brew.resume).toBe("Resume");
  expect(merged.brew.complete).toBe("Brew complete");
});

// Stored once and read by `format.ts`, so core and React cannot disagree about
// what a method is called.
test("methodLabel reads the same vocabulary the label set exposes", () => {
  const table: Record<string, string | undefined> = defaultLabels.methods;
  for (const slug of Object.keys(table)) expect(methodLabel(slug), slug).toBe(table[slug]);
});

test("the default method table is prototype-safe on its own", () => {
  // The table's own type does not admit these keys; the point is that the
  // RUNTIME object does not either.
  const table: Record<string, string | undefined> = defaultLabels.methods;
  expect(table["__proto__"]).toBeUndefined();
  expect(table["constructor"]).toBeUndefined();
});


// A renderer never spells a token, so every closed set one prints needs a label
// for every member. Schema → arrays → labels, with nothing free to drift between:
// `vocabularies.test.ts` holds the arrays equal to the schema, and `tsc` is the
// real assertion on the `Record<T, string>` parameter here.
test("every vocabulary label set names every token of its vocabulary", () => {
  const missing = <T extends string>(tokens: readonly T[], table: Record<T, string>): T[] =>
    tokens.filter((t) => !table[t]);
  expect(missing(BREW_METHODS, defaultLabels.methods)).toEqual([]);
  expect(missing(PROCESSES, defaultLabels.processes)).toEqual([]);
  expect(missing(STEP_KINDS, defaultLabels.stepKinds)).toEqual([]);
  expect(missing(ROAST_LEVELS, defaultLabels.roastLevels)).toEqual([]);
  expect(missing(GRIND_SIZES, defaultLabels.grindSizes)).toEqual([]);
  expect(missing(FILTER_MATERIALS, defaultLabels.filterMaterials)).toEqual([]);
});

// Every set a renderer PRINTS has labels, not every set: a table nothing reads is
// a second place for the vocabulary to drift. Stated as a test so adding the
// display and forgetting the labels is a conversation, not a silent slug.
test("bean `form` has no label set, because nothing renders it", () => {
  expect(BEAN_FORMS).toContain("drip_bag");
  expect(Object.keys(defaultLabels)).not.toContain("beanForms");
});

test("the vocabulary tables are prototype-safe, every one of them", () => {
  // The tables' own types do not admit these keys; the RUNTIME objects must not
  // either.
  const tables: Record<string, string | undefined>[] = [
    defaultLabels.methods, defaultLabels.processes, defaultLabels.stepKinds,
    defaultLabels.roastLevels, defaultLabels.grindSizes,
  ];
  for (const table of tables) {
    expect(table["__proto__"]).toBeUndefined();
    expect(table["constructor"]).toBeUndefined();
  }
  const merged = mergeLabels({ processes: { washed: "Lavado" } });
  expect((merged.processes as Record<string, string | undefined>)["__proto__"]).toBeUndefined();
});

test("the new vocabularies merge by token, keeping the defaults not overridden", () => {
  const l = mergeLabels({
    processes: { washed: "Lavado" },
    stepKinds: { bloom: "Floración" },
    roastLevels: { light: "Claro" },
    grindSizes: { fine: "Fino" },
  });
  expect(l.processes.washed).toBe("Lavado");
  expect(l.processes.natural).toBe("Natural");        // default kept
  expect(l.stepKinds.bloom).toBe("Floración");
  expect(l.stepKinds.pour).toBe("Pour");              // default kept
  expect(l.roastLevels.light).toBe("Claro");
  expect(l.roastLevels.dark).toBe("Dark");            // default kept
  expect(l.grindSizes.fine).toBe("Fino");
  expect(l.grindSizes.coarse).toBe("Coarse");         // default kept
});

// A consumer must be able to localize a token this build does not know, exactly
// as it must not reject a document for carrying one.
test("a vocabulary override may name a token this build has never heard of", () => {
  const l = mergeLabels({ processes: { koji: "Koji" } });
  expect(vocabularyLabel(l.processes, "koji")).toBe("Koji");
});

// Which of the spec's two fallbacks applies is a property of the vocabulary, not
// a policy the caller chooses: a set defining `other` falls back to it, and the
// two ordered scales define none and so answer with nothing.
test("vocabularyLabel: a known token, `other`, and a token this build lacks", () => {
  expect(vocabularyLabel(defaultLabels.processes, "pulped_natural")).toBe("Pulped natural");
  expect(vocabularyLabel(defaultLabels.processes, "other")).toBe("Other");
  expect(vocabularyLabel(defaultLabels.processes, "koji")).toBe("Other");

  expect(vocabularyLabel(defaultLabels.stepKinds, "valve_close")).toBe("Close valve");
  expect(vocabularyLabel(defaultLabels.stepKinds, "other")).toBe("Other");
  expect(vocabularyLabel(defaultLabels.stepKinds, "laminar_pour")).toBe("Other");

  expect(vocabularyLabel(defaultLabels.roastLevels, "light_medium")).toBe("Light-medium");
  expect(vocabularyLabel(defaultLabels.roastLevels, "charcoal")).toBe("");

  expect(vocabularyLabel(defaultLabels.grindSizes, "medium_coarse")).toBe("Medium-coarse");
  expect(vocabularyLabel(defaultLabels.grindSizes, "gravelly")).toBe("");

  expect(vocabularyLabel(defaultLabels.methods, null)).toBe("");
  expect(vocabularyLabel(defaultLabels.methods, "")).toBe("");
});

test("the ordered scales define no `other` to fall back to, and must not grow one", () => {
  expect(Object.keys(defaultLabels.roastLevels)).not.toContain("other");
  expect(Object.keys(defaultLabels.grindSizes)).not.toContain("other");
});

test("every decode reason has a default sentence, and re-wording is key-by-key", () => {
  const missing = DECODE_ERROR_KINDS.filter((kind) => !defaultLabels.decodeErrors[kind]);
  expect(missing).toEqual([]);
  const extra = Object.keys(defaultLabels.decodeErrors)
    .filter((k) => !(DECODE_ERROR_KINDS as readonly string[]).includes(k));
  expect(extra).toEqual([]);
  const merged = mergeLabels({ decodeErrors: { not_json: "Pas du JSON." } });
  expect(merged.decodeErrors.not_json).toBe("Pas du JSON.");
  expect(merged.decodeErrors.no_payload).toBe(defaultLabels.decodeErrors.no_payload);
});
