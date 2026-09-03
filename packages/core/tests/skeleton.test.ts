import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("core has zero runtime dependencies (standing guard)", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  expect(Object.keys(pkg.dependencies ?? {})).toEqual([]);
});

test("core is publishable, and publishes public (standing guard)", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  expect(pkg.private).toBeUndefined();
  expect(pkg.publishConfig?.access).toBe("public");
});

// `decodeDocumentText` was documented in the README and absent from the barrel
// through 1.0.0, so a reader following the README could not import it. Prose and
// surface drift apart silently; this makes them fail together.
test("every function the README names is importable (standing guard)", async () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  // A code span whose text is an identifier followed by "(" is a call, so the
  // README is telling a reader to invoke it.
  const named = new Set(
    [...readme.matchAll(/`([a-z][A-Za-z0-9_]*)\s*\(/g)].map(
      (m) => m[1] as string,
    ),
  );
  // `http(s)` reads as a call and is a URL scheme. Anything else added here is a
  // claim that the README named something the package does not vend, so it wants
  // a reason beside it.
  named.delete("http");
  const surface = await import("../src/index.js");
  expect([...named].filter((n) => !(n in surface))).toEqual([]);
});
