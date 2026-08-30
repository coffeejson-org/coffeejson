import { expect, test } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import { CoffeeJSONView } from "../src/CoffeeJSONView";

const root = fileURLToPath(new URL("../../..", import.meta.url));

const countOf = (html: string, cls: string): number =>
  (html.match(new RegExp(`class="[^"]*\\b${cls}\\b[^"]*"`, "g")) ?? []).length;

test("every corpus document renders exactly one card per normalized entity", () => {
  for (const dir of ["fixtures/valid", "recipes"])
    for (const f of readdirSync(join(root, dir)).filter((f) => f.endsWith(".json") && f !== "catalog.json")) {
      const doc = JSON.parse(readFileSync(join(root, dir, f), "utf8"));
      const n = normalize(doc);
      const html = renderToStaticMarkup(<CoffeeJSONView doc={doc} />);
      const label = `${dir}/${f}`;
      expect(countOf(html, "cj-recipe-card"), label).toBe(n.recipes.length);
      expect(countOf(html, "cj-bean-card"), label).toBe(n.beans.length);
      // A rendered fact row must never be empty: the card suppresses a fact whose
      // value formats to nothing, so an empty value span means the suppression
      // rule was bypassed somewhere.
      expect(html, label).not.toContain(`class="cj-fact-value"></span>`);
    }
});
