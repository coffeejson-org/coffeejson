import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// The package's main entry runs where there is no DOM: a server, a worker, a
// React Native bundle. The element is the one part that needs a browser, so it
// has its own directory, compiled by its own project, and nothing outside that
// directory may import from it.
const src = fileURLToPath(new URL("../src", import.meta.url));
const outside = readdirSync(src, { withFileTypes: true })
  .filter((f) => f.isFile() && f.name.endsWith(".ts"))
  .map((f) => f.name);

test("there are source files to check", () => {
  expect(outside).toContain("index.ts");
  expect(outside.length).toBeGreaterThan(10);
});

test.each(outside)("%s imports nothing from the element", (name) => {
  expect(readFileSync(join(src, name), "utf8")).not.toMatch(
    /from\s+["']\.\/element\//,
  );
});

test("the main entry's project still compiles without the DOM", () => {
  const cfg = JSON.parse(
    readFileSync(join(src, "..", "tsconfig.json"), "utf8"),
  );
  expect(cfg.compilerOptions.lib).toEqual(["ES2022"]);
  expect(cfg.exclude).toContain("src/element");
});
