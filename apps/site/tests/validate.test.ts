import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { validateDocument } from "../src/lib/validate";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const docs = (dir: string) =>
  readdirSync(join(root, dir)).filter((f) => f.endsWith(".json"))
    .map((f) => [join(dir, f), JSON.parse(readFileSync(join(root, dir, f), "utf8"))] as const);

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
  for (const [name, doc] of docs("recipes").filter(([n]) => !n.endsWith("catalog.json")))
    test(`${name} validates`, () => expect(validateDocument(doc)).toEqual([]));
});
