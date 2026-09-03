import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { EXAMPLES, PITFALLS, SYSTEM_PROMPT } from "../src/lib/agent-examples";

const repo = fileURLToPath(new URL("../../..", import.meta.url));
const load = (p: string) => JSON.parse(readFileSync(join(repo, p), "utf8"));

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);

// The STRICT schema on purpose. The page tells agents to validate against the
// authoring schema, so its own examples must clear that same bar — including
// its refusal of unknown keys. An example with a typo would teach the typo.
const validateStrict = ajv.compile(
  load("docs/schema/coffeejson-1.0.authoring.schema.json"),
);
const validateRuntime = ajv.compile(
  load("docs/schema/coffeejson-1.0.schema.json"),
);

describe("/for-ai-agents examples", () => {
  it.each(EXAMPLES.map((e, i) => [i, e.prompt] as const))(
    "example %i (%s) validates against the AUTHORING schema",
    (i) => {
      const ok = validateStrict(EXAMPLES[i]!.doc);
      const errs = (validateStrict.errors ?? []).map(
        (e) => `${e.instancePath || "/"} ${e.message}`,
      );
      expect(ok, `authoring-schema errors:\n  ${errs.join("\n  ")}`).toBe(true);
    },
  );

  it.each(EXAMPLES.map((e, i) => [i, e.prompt] as const))(
    "example %i (%s) also validates against the runtime schema",
    (i) => {
      expect(validateRuntime(EXAMPLES[i]!.doc)).toBe(true);
    },
  );

  it("covers the three shapes an agent is actually asked for", () => {
    const docs = EXAMPLES.map((e) => e.doc as Record<string, unknown>);
    expect(
      docs.some((d) => !("steps" in ((d["recipes"] as never[])?.[0] ?? {}))),
    ).toBe(true);
    expect(
      docs.some((d) => "steps" in ((d["recipes"] as never[])?.[0] ?? {})),
    ).toBe(true);
    expect(docs.some((d) => "beans" in d && !("recipes" in d))).toBe(true);
  });

  it("the system prompt names the authoring schema and the cumulative-water trap", () => {
    // The canonical $id, not the filename alias — a prompt copied into someone
    // else's system message should carry the address the schema claims.
    expect(SYSTEM_PROMPT).toContain(
      "https://coffeejson.org/schema/authoring/1.0",
    );
    expect(SYSTEM_PROMPT).toMatch(/CUMULATIVE/);
    expect(SYSTEM_PROMPT).toMatch(/Omit anything you do not know/);
  });

  it("every pitfall's WRONG form really is rejected by the authoring schema", () => {
    // Guards against a pitfall going stale — if the schema ever started
    // accepting one of these, the page would be teaching a rule that no longer
    // exists. Checked with the two that are whole-document expressible.
    expect(
      validateStrict({
        coffeejson: "1.0",
        recipes: [{ title: "x", coffee: 15 }],
      }),
    ).toBe(false);
    expect(
      validateStrict({
        coffeejson: "1.0",
        recipes: [{ title: "x", coffee: { value: 15, unit: "g" } }],
      }),
    ).toBe(false);
    expect(PITFALLS.length).toBeGreaterThanOrEqual(5);
  });
});
