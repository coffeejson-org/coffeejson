// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultLabels, normalize } from "@coffeejson/core";
import { ELEMENT_STYLES, renderView } from "@coffeejson/core/element";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CoffeeJSONView } from "../src/CoffeeJSONView";

// The package has two renderers of one projection: these React cards, and the
// framework-free `<coffee-json>` element in `@coffeejson/core`. A fact added to
// one and not the other would show a reader two different coffees, so every
// document in the repository is drawn both ways and read back.

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const docs = ["fixtures/valid", "recipes"].flatMap((dir) =>
  readdirSync(`${root}/${dir}`)
    .filter((f) => f.endsWith(".json") && f !== "catalog.json")
    .map(
      (f) =>
        [
          `${dir}/${f}`,
          JSON.parse(readFileSync(`${root}/${dir}/${f}`, "utf8")),
        ] as const,
    ),
);

// What a reader sees: each element's own text, with runs of whitespace as one
// space. Markup differences that change no text are not differences.
const words = (node: Element | null): string =>
  (node?.textContent ?? "").replace(/\s+/g, " ").trim();
const facts = (node: Element | null): string[] =>
  [...(node?.querySelectorAll("[data-cj-fact]") ?? [])].map(
    (f) => `${f.getAttribute("data-cj-fact")}=${words(f)}`,
  );

describe("the element and the React cards say the same thing", () => {
  test("there are documents to compare", () => {
    expect(docs.length).toBeGreaterThan(50);
  });

  test.each(docs)("%s", (_, doc) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(<CoffeeJSONView doc={doc} />);
    const react = host.querySelector(".cj-view");
    const element = renderView(
      normalize(doc),
      { labels: defaultLabels, units: "as-authored", locale: "en" },
      document,
    );
    expect(facts(element)).toEqual(facts(react));
    expect(words(element)).toBe(words(react));
    expect(element?.querySelectorAll("a").length ?? 0).toBe(
      react?.querySelectorAll("a").length ?? 0,
    );
  });
});

describe("the element's stylesheet is the React skin's card rules", () => {
  const skin = readFileSync(`${root}/packages/react/styles.css`, "utf8");
  // `selector { body }` pairs, comments dropped, whitespace collapsed.
  const rules = (css: string): Map<string, string> =>
    new Map(
      [
        ...css
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .matchAll(/([^{}]+)\{([^{}]*)\}/g),
      ].map((m) => [
        m[1]!.replace(/\s+/g, " ").trim(),
        m[2]!.replace(/\s+/g, " ").trim(),
      ]),
    );
  const theirs = rules(skin);
  const ours = rules(ELEMENT_STYLES);
  // Where the two deliberately differ: the element sets the custom properties
  // on `:host`, and has rules for parts the skin leaves unstyled.
  const ownRules = [
    ":host",
    ":host([hidden])",
    ".cj-view",
    ".cj-generator",
    ".cj-actions",
    ".cj-actions a, .cj-actions button",
  ];

  test.each([...ours.keys()].filter((s) => !ownRules.includes(s)))(
    "%s matches the skin",
    (selector) => {
      expect(ours.get(selector)).toBe(theirs.get(selector));
    },
  );

  test("every custom property the skin defines is defined on the host", () => {
    const props = [
      ...(theirs.get(".cj-view") ?? "").matchAll(/(--cj-[a-z]+):\s*([^;]+);/g),
    ];
    expect(props.length).toBeGreaterThan(5);
    for (const [, name, value] of props)
      expect(ours.get(":host")).toContain(`${name}: ${value};`);
  });
});
