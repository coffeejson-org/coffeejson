import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { CoffeeJSONView } from "../src/CoffeeJSONView";

const BATTERY: unknown[] = [
  null,
  undefined,
  true,
  0,
  42,
  -1,
  "x",
  "__proto__",
  "",
  {},
  [],
  [null],
  { value: "x" },
  { a: { b: { c: [{ d: 1 }] } } },
  "x".repeat(5000),
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "//evil.example",
];
const baseRecipe = {
  title: "Base",
  method: "espresso",
  brewer: { id: "b1" },
  coffee: { value: 19, unit: "gram" },
  yield: { value: 47, unit: "gram" },
  water: { value: 300, unit: "gram" },
  ratio: 15,
  water_temp: { value: 93, unit: "celsius" },
  grind: { grinder: { id: "g" }, setting: "18", microns_approx: 700 },
  pressure: { value: 9, unit: "bar" },
  preinfusion_s: 5,
  basket: { id: "bk" },
  steps: [
    {
      kind: "pour",
      at_s: 0,
      to_water: { value: 50, unit: "gram" },
      instruction: "Bloom",
    },
  ],
  finish_s: 28,
  bean_ref: "b",
  recommended: true,
};
const baseBean = {
  id: "b",
  name: "N",
  roaster: "R",
  url: "https://example.com",
  origin: {
    items: [
      { name: "F", country: "CO", region: "H", process: "W", percentage: 100 },
    ],
  },
  varietals: ["V"],
  roast_level: "medium",
  roaster_notes: ["x"],
  description: "d",
};

test("field-substitution battery: render never throws, never emits an unsafe href", () => {
  const render = (doc: unknown) =>
    renderToStaticMarkup(<CoffeeJSONView doc={doc} />);
  for (const v of BATTERY) expect(() => render(v)).not.toThrow();
  for (const field of Object.keys(baseRecipe))
    for (const v of BATTERY) {
      const html = render({
        coffeejson: "1.0",
        beans: [baseBean],
        recipes: [{ ...baseRecipe, [field]: v }],
      });
      expect(html).not.toContain('href="javascript:');
      for (const h of [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]))
        expect(h, `${field}=${String(v)}`).toMatch(/^(https?:|mailto:)/i);
    }
  for (const field of Object.keys(baseBean))
    for (const v of BATTERY) {
      const doc = {
        coffeejson: "1.0",
        beans: [{ ...baseBean, [field]: v }],
        recipes: [baseRecipe],
      };
      expect(() => render(doc)).not.toThrow();
      const html = render(doc);
      for (const h of [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]))
        expect(h, `${field}=${String(v)}`).toMatch(/^(https?:|mailto:)/i);
    }
});

// Every place a document-supplied string becomes an href: a bean's own page, and
// the document's generator link.
test("no unsafe URL scheme becomes an href (bean.url or generator.url)", () => {
  for (const u of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "\tjavascript:x",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "//evil.example",
    "file:///etc/passwd",
  ]) {
    const html = renderToStaticMarkup(
      <CoffeeJSONView
        doc={{
          coffeejson: "1.0",
          beans: [{ name: "x", url: u }],
          recipes: [{ title: "t" }],
          generator: { name: "Gen", url: u },
        }}
      />,
    );
    expect(html, u).not.toMatch(/href="(?!https?:|mailto:)/i);
    // The link is suppressed, not merely descheme'd — the name still renders as
    // plain text so the provenance line does not vanish.
    expect(html, u).toContain("Gen");
  }
});
