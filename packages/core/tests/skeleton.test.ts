import { expect, test } from "vitest";
import { readFileSync } from "node:fs";

test("core has zero runtime dependencies (standing guard)", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
});

test("core is publishable, and publishes public (standing guard)", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  expect(pkg.private).toBeUndefined();
  expect(pkg.publishConfig?.access).toBe("public");
});
