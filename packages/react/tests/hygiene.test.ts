import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const srcDir = fileURLToPath(new URL("../src", import.meta.url));
const sources = readdirSync(srcDir, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
  .map((f) => [f, readFileSync(join(srcDir, f), "utf8")] as const);

test("src/ never uses dangerouslySetInnerHTML, window/document globals, or react-dom", () => {
  expect(sources.length).toBeGreaterThan(0);
  for (const [name, code] of sources) {
    expect(code, name).not.toContain("dangerouslySetInnerHTML");
    expect(code, name).not.toMatch(/\bwindow[.\[]/);
    expect(code, name).not.toMatch(/\bdocument[.\[]/);
    expect(code, name).not.toContain("react-dom");
  }
});

// A component never spells a token: munging the wire value instead is what put
// "light medium" on a bean card, past a label table that had no entry to miss.
test("src/ never spells a vocabulary token instead of reading its label", () => {
  for (const [name, code] of sources) {
    expect(code, name).not.toMatch(/replace\(\s*\/_\/g/);
    expect(code, name).not.toMatch(/replaceAll\(\s*"_"/);
  }
});
