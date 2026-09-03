import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lintDocument, validateDocument } from "../src/lib/validate";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const docs = (dir: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        [
          join(dir, f),
          JSON.parse(readFileSync(join(root, dir, f), "utf8")),
        ] as const,
    );

describe("cross-implementation parity with the fixture corpus", () => {
  for (const [name, doc] of docs("fixtures/valid"))
    test(`${name} validates`, () => expect(validateDocument(doc)).toEqual([]));
  for (const [name, doc] of docs("fixtures/invalid"))
    test(`${name} is rejected with a pathed message`, () => {
      const issues = validateDocument(doc);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0]).toHaveProperty("path");
      expect(issues[0]).toHaveProperty("message");
    });
  for (const [name, doc] of docs("recipes").filter(
    ([n]) => !n.endsWith("catalog.json"),
  ))
    test(`${name} validates`, () => expect(validateDocument(doc)).toEqual([]));
});

// The page runs the strict schema over whatever the open one accepts. These two
// fixtures exist to prove runtime leniency at the CURRENT minor, so they are
// exactly the documents the lint must speak up about; every other valid document
// must pass both in silence.
const lenient = new Set([
  "forward-compat-unknown-fields.json",
  "images-empty.json",
]);

// A later minor is not lenience, it is a document this build cannot judge. Its
// unknown members are real fields, so the lint has to stay out of it.
const newerMinor = "newer-minor-version.json";

describe("the authoring lint over documents the runtime schema accepts", () => {
  for (const [name, doc] of docs("fixtures/valid")) {
    const bare = basename(name);
    if (bare === newerMinor)
      test(`${name} is a later minor, so the lint says nothing`, () =>
        expect(lintDocument(doc)).toEqual([]));
    else if (lenient.has(bare))
      test(`${name} draws an authoring note`, () =>
        expect(lintDocument(doc).length).toBeGreaterThan(0));
    else
      test(`${name} passes the lint too`, () =>
        expect(lintDocument(doc)).toEqual([]));
  }
  for (const [name, doc] of docs("recipes").filter(
    ([n]) => !n.endsWith("catalog.json"),
  ))
    test(`${name} passes the lint too`, () =>
      expect(lintDocument(doc)).toEqual([]));

  // The whole point of the page change: valid, and the note is the only thing
  // that tells the author the note was dropped.
  test("a typo'd member is valid at runtime and drawn out by the lint", () => {
    const typo = {
      coffeejson: "1.0",
      recipes: [
        {
          title: "x",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          watter_temp: { value: 93, unit: "celsius" },
        },
      ],
    };
    expect(validateDocument(typo)).toEqual([]);
    expect(lintDocument(typo).length).toBeGreaterThan(0);
  });

  // The reserved vendor home is not a typo, and must not be reported as one.
  test("the reserved vendor member draws no note, at any depth", () => {
    const vendor = {
      coffeejson: "1.0",
      recipes: [
        {
          title: "x",
          coffee: { value: 15, unit: "gram" },
          water: { value: 250, unit: "gram" },
          brewer: {
            id: "custom",
            label: "Bench dripper",
            ext: { "app.example": { asset_tag: "D-14" } },
          },
          ext: { "app.example": { collection: "favorites" } },
        },
      ],
    };
    expect(validateDocument(vendor)).toEqual([]);
    expect(lintDocument(vendor)).toEqual([]);
  });
});

describe("what a note actually says", () => {
  const recipe = (extra: Record<string, unknown>) => ({
    coffeejson: "1.0",
    recipes: [
      {
        title: "x",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
        ...extra,
      },
    ],
  });

  // ajv keeps the offending member in `params`, so without it two typos in one
  // object are two identical lines and the note names nothing.
  test("each note names the member it is about", () => {
    const notes = lintDocument(
      recipe({ watter_temp: { value: 93, unit: "celsius" }, grindd: "fine" }),
    );
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.message).sort()).toEqual([
      "must NOT have additional properties: grindd",
      "must NOT have additional properties: watter_temp",
    ]);
  });

  // ajv already quotes the member for `required`, so appending it there reads
  // "must have required property \'coffee\': coffee". Conformance errors go
  // through the same helper, so this guards the validator and generator pages.
  test("a missing required field is not named twice", () => {
    const missing = validateDocument({
      coffeejson: "1.0",
      recipes: [{ title: "x" }],
    });
    const required = missing.filter((i) =>
      i.message.startsWith("must have required property"),
    );
    expect(required.length).toBeGreaterThan(0);
    for (const i of required) expect(i.message).not.toMatch(/: \w+$/);
  });

  // The same document twice, differing only in the minor it states. At 1.0 the
  // member is a typo this build can judge; at 1.7 it is a field this build has
  // never heard of, and calling it a typo would be a lie.
  test("a later minor silences the lint, the current one does not", () => {
    const unknown = { hypothetical_field: "x" };
    expect(lintDocument(recipe(unknown)).length).toBeGreaterThan(0);
    expect(lintDocument({ ...recipe(unknown), coffeejson: "1.7" })).toEqual([]);
  });
});
