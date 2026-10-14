// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CoffeeJsonElement } from "@coffeejson/core/element";
import { expect, test } from "vitest";
import { elementAttributes } from "../src/lib/element-attributes";

const readme = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../packages/core/README.md",
  ),
  "utf8",
);
const SECTION =
  "## The `<coffee-json>` element\n\n| Attribute | What it does |\n| --- | --- |\n";

test("the README's table names exactly the attributes the element observes", () => {
  const names = elementAttributes(readme).map((r) => r.name);
  expect(new Set(names)).toEqual(new Set(CoffeeJsonElement.observedAttributes));
  expect(names).toHaveLength(CoffeeJsonElement.observedAttributes.length);
});

test("code spans become <code> and everything else is escaped", () => {
  const [row] = elementAttributes(
    `${SECTION}| \`d\` | A payload after \`?d=\` & <b>more</b>. |\n`,
  );
  expect(row).toEqual({
    name: "d",
    html: "A payload after <code>?d=</code> &amp; &lt;b&gt;more&lt;/b&gt;.",
  });
});

test("a link in a cell fails, rather than reaching the page as brackets", () => {
  expect(() =>
    elementAttributes(`${SECTION}| \`d\` | See [the spec](x). |\n`),
  ).toThrow(/cannot render/);
});

test("a README without the section or the table fails the build", () => {
  expect(() => elementAttributes("# core\n")).toThrow(
    /no "## The `<coffee-json>` element" section/,
  );
  expect(() =>
    elementAttributes("## The `<coffee-json>` element\n\nNo table.\n"),
  ).toThrow(/no attribute table/);
});
