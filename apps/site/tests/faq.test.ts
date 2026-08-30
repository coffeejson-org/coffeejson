import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { FAQ, faqJsonLd } from "../src/lib/faq.mjs";

// The FAQ is published twice — as prose the landing page renders in the browser,
// and as FAQPage JSON-LD sitting in the static head of index.html so a reader
// that runs no JavaScript still gets it. Google treats a mismatch between the two
// as a reason to drop the rich result, and a second hand-kept copy is exactly how
// a mismatch arrives. So the head is compared against the array both come from.
const site = fileURLToPath(new URL("..", import.meta.url));
const index = readFileSync(site + "index.html", "utf8");

const blocks = [...index.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
  .map((m) => JSON.parse(m[1]!.replace(/\\u003c/g, "<")));

test("index.html publishes the FAQ the landing page renders", () => {
  const faq = blocks.flat().find((b) => b["@type"] === "FAQPage");
  expect(faq, "no FAQPage block in index.html").toBeTruthy();
  expect(faq).toEqual(faqJsonLd());
});

test("every answer stands alone", () => {
  for (const { q, a } of FAQ) {
    // A question mark in the question, and an answer that is a sentence rather
    // than a fragment continuing it.
    expect(q, q).toMatch(/\?$/);
    expect(a, q).toMatch(/^[A-Z]/);
    expect(a, q).toMatch(/\.$/);
    // Long enough to answer, short enough to be quoted whole.
    const words = a.split(/\s+/).length;
    expect(words, `${q} — ${words} words`).toBeGreaterThan(25);
    expect(words, `${q} — ${words} words`).toBeLessThan(75);
  }
});

test("the answers name no pronoun the question supplied", () => {
  // "It is free" only works next to its question. An extracted answer has to
  // carry the subject itself.
  for (const { q, a } of FAQ) expect(a.slice(0, 12), q).not.toMatch(/^(It|They|That|This) /);
});
