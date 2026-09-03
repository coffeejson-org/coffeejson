import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

test("react-jsx + renderToStaticMarkup work in a node environment (SSR harness)", () => {
  expect(renderToStaticMarkup(<p className="cj-smoke">ok</p>)).toBe(
    '<p class="cj-smoke">ok</p>',
  );
});

test("react takes react as a peer, react-dom dev-only (standing guard)", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@coffeejson/core"]);
  expect(Object.keys(pkg.peerDependencies ?? {})).toEqual(["react"]);
});

test("react is publishable, publishes public, and ranges core (standing guard)", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  expect(pkg.private).toBeUndefined();
  expect(pkg.publishConfig?.access).toBe("public");
  // `workspace:*` publishes as an exact version, which leaves a consumer with two
  // copies of core after any core patch. The caret is what makes the dependency a range.
  expect(pkg.dependencies["@coffeejson/core"]).toBe("workspace:^");
});
