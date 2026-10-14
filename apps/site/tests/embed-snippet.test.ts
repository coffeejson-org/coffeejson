import { decodePayload } from "@coffeejson/core";
import { expect, test } from "vitest";
import { elementScriptUrl } from "../src/lib/element-url.mjs";
import {
  documentTitle,
  EMBED_VIEWER,
  embedSnippet,
  jsonLdByDefault,
} from "../src/lib/embed-snippet";

const recipe = {
  coffeejson: "1.1",
  recipes: [
    {
      title: `Tom's "best" <V60> & co`,
      method: "pour_over",
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
    },
  ],
};
const bag = {
  coffeejson: "1.1",
  beans: [{ name: "Sermon", roaster: { name: "A roaster" } }],
  recipes: [
    {
      title: "Sermon V60",
      method: "pour_over",
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
    },
  ],
};

test("the viewer is the slashed /r/ the label sheets print", () => {
  expect(EMBED_VIEWER).toBe("https://coffeejson.org/r/");
});

test("the snippet is four lines: script, element, fallback link, close", () => {
  const lines = embedSnippet(bag, { version: "9.8.7", jsonld: false }).split(
    "\n",
  );
  expect(lines).toHaveLength(4);
  expect(lines[0]).toBe(
    `<script type="module" src="${elementScriptUrl("9.8.7")}"></script>`,
  );
  expect(lines[1]).toMatch(
    /^<coffee-json d="[A-Za-z0-9_-]+" viewer="https:\/\/coffeejson\.org\/r\/" viewer-label="Open">$/,
  );
  expect(lines[2]).toMatch(
    /^ {2}<a href="https:\/\/coffeejson\.org\/r\/\?d=[A-Za-z0-9_-]+">Sermon, as CoffeeJSON<\/a>$/,
  );
  expect(lines[3]).toBe("</coffee-json>");
});

test("the element's d and the fallback's d are the same payload, and it decodes to the document", () => {
  const s = embedSnippet(bag, { version: "1.2.0", jsonld: false });
  const [a, b] = [...s.matchAll(/d=["]?([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  expect(a).toBe(b);
  const decoded = decodePayload(a!);
  expect(decoded.ok && decoded.document).toMatchObject({
    beans: [{ name: "Sermon" }],
  });
});

test("jsonld is a bare attribute when asked for, and absent otherwise", () => {
  expect(embedSnippet(recipe, { version: "1.2.0", jsonld: true })).toContain(
    'viewer-label="Open" jsonld>',
  );
  expect(
    embedSnippet(recipe, { version: "1.2.0", jsonld: false }),
  ).not.toContain("jsonld");
});

test("a title is escaped, so a quote or a tag cannot break out of the snippet", () => {
  const s = embedSnippet(recipe, { version: "1.2.0", jsonld: false });
  expect(s).toContain(
    "Tom&#39;s &quot;best&quot; &lt;V60&gt; &amp; co, as CoffeeJSON",
  );
  expect(s).not.toContain("<V60>");
});

test("a document is called by its bag when it has one, else by its recipe", () => {
  expect(documentTitle(bag)).toBe("Sermon");
  expect(documentTitle(recipe)).toBe(`Tom's "best" <V60> & co`);
  expect(documentTitle({ coffeejson: "1.1", recipes: [{ title: "  " }] })).toBe(
    "A coffee",
  );
});

test("jsonld defaults on for a recipe alone and off when a bag is present", () => {
  expect(jsonLdByDefault(recipe)).toBe(true);
  expect(jsonLdByDefault(bag)).toBe(false);
  expect(jsonLdByDefault({ coffeejson: "1.1", beans: [{ name: "x" }] })).toBe(
    false,
  );
});
