// @vitest-environment jsdom

import { decodePayload, encodePayload } from "@coffeejson/core";
import { beforeEach, expect, test, vi } from "vitest";
import documents from "../src/generated/embed-documents.json";
import { wireEmbedPage } from "../src/lib/embed-client";
import { DEFAULT_SLUG, embedBody, USE_CASE_SLUGS } from "../src/pages/embed";

// jsdom never runs the CDN script, so the card stays its fallback here. These
// read the attribute the script would draw from, and the snippet text.

const $ = <T extends Element>(s: string) => document.querySelector<T>(s)!;
const card = () => $<HTMLElement>("#embed-card");
const snippet = () => $<HTMLElement>("[data-embed-snippet]").textContent!;
const pick = () => $<HTMLSelectElement>("[data-embed-pick]");
const jsonld = () => $<HTMLInputElement>("[data-embed-jsonld]");
const error = () => $<HTMLElement>("[data-embed-error]");
const payload = (slug: string) =>
  documents.find((d) => d.slug === slug)!.payload;
const choose = async (value: string) => {
  pick().value = value;
  pick().dispatchEvent(new Event("change"));
  await vi.waitFor(() =>
    expect(snippet()).toContain(encodePayload(decoded(payload(value)))),
  );
};
const decoded = (p: string) => {
  const r = decodePayload(p);
  if (!r.ok) throw new Error(r.error.kind);
  return r.document;
};

beforeEach(() => {
  document.body.innerHTML = `<main id="app">${embedBody()}</main>`;
});

test("the build's default is in the card and the snippet before any script", () => {
  expect(card().getAttribute("d")).toBe(payload(DEFAULT_SLUG));
  expect(snippet()).toContain(
    `d="${encodePayload(decoded(payload(DEFAULT_SLUG)))}"`,
  );
});

test("picking a document swaps the card's d, the snippet, and the jsonld default", async () => {
  wireEmbedPage(document, "");
  await choose(USE_CASE_SLUGS.blog);
  expect(card().getAttribute("d")).toBe(
    encodePayload(decoded(payload(USE_CASE_SLUGS.blog))),
  );
  expect(jsonld().checked).toBe(true);
  expect(snippet()).toContain(" jsonld>");
});

test("the checkbox rewrites the snippet without a pick", () => {
  wireEmbedPage(document, "");
  jsonld().checked = true;
  jsonld().dispatchEvent(new Event("change"));
  expect(snippet()).toContain(" jsonld>");
});

test("?d= from the generator becomes 'Your document', selected", () => {
  const mine = encodePayload({
    coffeejson: "1.1",
    recipes: [
      {
        title: "Mine",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
      },
    ],
  });
  wireEmbedPage(document, `?d=${mine}`);
  expect(pick().value).toBe("yours");
  expect(pick().options[0]!.textContent).toBe("Your document");
  expect(card().getAttribute("d")).toBe(mine);
  expect(snippet()).toContain("Mine, as CoffeeJSON");
  expect(error().hidden).toBe(true);
});

test("a ?d= that does not decode says so and keeps the default", () => {
  wireEmbedPage(document, "?d=not-a-payload");
  expect(error().hidden).toBe(false);
  expect(error().textContent).toMatch(
    /^This link's document could not be read: \w+\.$/,
  );
  expect(pick().value).toBe(DEFAULT_SLUG);
  expect(card().getAttribute("d")).toBe(payload(DEFAULT_SLUG));
});

test("a ?d= holding no bean or recipe names the decoder's reason and keeps the default", () => {
  const empty = encodePayload({ coffeejson: "1.1", recipes: [] });
  wireEmbedPage(document, `?d=${empty}`);
  expect(error().textContent).toBe(
    "This link's document could not be read: empty_document.",
  );
  expect(pick().value).toBe(DEFAULT_SLUG);
});

test("picking 'Your document' again brings the visitor's own document back", async () => {
  const mine = encodePayload({
    coffeejson: "1.1",
    recipes: [
      {
        title: "Mine",
        coffee: { value: 15, unit: "gram" },
        water: { value: 250, unit: "gram" },
      },
    ],
  });
  wireEmbedPage(document, `?d=${mine}`);
  await choose(USE_CASE_SLUGS.blog);
  pick().value = "yours";
  pick().dispatchEvent(new Event("change"));
  await vi.waitFor(() => expect(snippet()).toContain("Mine, as CoffeeJSON"));
  expect(card().getAttribute("d")).toBe(mine);
});
