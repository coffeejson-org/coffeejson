import { readdirSync } from "node:fs";
import { expect, test } from "vitest";
import beans from "../src/generated/beans-index.json";
import {
  beanPagePath,
  beanPageSlug,
  buildBeanPages,
  corpusPageSlugs,
  INDEXABLE_PATHS,
} from "../tools/gen.mjs";

// The bean slug space. The gear registry's answer to collisions is
// "curation catches them at registration" — nobody registers a bag, so the
// check has to live here.
test("every bean identity produces a distinct slug", () => {
  const slugs = beans.map((b) => b.slug);
  expect(
    new Set(slugs).size,
    `duplicates: ${slugs.filter((s, i) => slugs.indexOf(s) !== i).join(", ")}`,
  ).toBe(slugs.length);
});

test("every slug is ASCII, lowercase, kebab — a path, not a display name", () => {
  // Paths are ASCII by decision: a Unicode slug percent-encodes to ~3x its
  // length in the `?s=` share link, on the surface built to shorten links.
  for (const b of beans)
    expect(b.slug, b.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("a name written in another script takes the slug its document already used", () => {
  // Not transliterated here: the corpus made these calls at transcription time
  // and they were reviewed then. Inventing a second answer is the failure.
  expect(
    beanPageSlug("サザコーヒー", "ゴールデンモカ", ["saza-golden-mocha"]),
  ).toBe("saza-golden-mocha");
  expect(
    beanPageSlug("ONIBUS COFFEE", "ケニア / ガトンボヤ", [
      "onibus-kenya-gatomboya",
    ]),
  ).toBe("onibus-kenya-gatomboya");
});

test("a Latin name folds, and does not consult the document", () => {
  expect(beanPageSlug("Onyx Coffee Lab", "Monarch", [])).toBe("onyx-monarch");
  expect(beanPageSlug("Equator Coffees", "Golden Hour Blend", [])).toBe(
    "equator-golden-hour-blend",
  );
});

test("the three roaster names no fold can compute are table entries", () => {
  // Each breaks a different rule: a location that is not a suffix, a space that
  // is not a hyphen, and a "coffee" that is part of the brand.
  expect(beanPageSlug("FUGLEN COFFEE ROASTERS TOKYO", "X", [])).toBe(
    "fuglen-x",
  );
  expect(beanPageSlug("LIGHT UP COFFEE", "X", [])).toBe("lightup-x");
  expect(beanPageSlug("DRINK COFFEE DO STUFF", "X", [])).toBe(
    "drink-coffee-do-stuff-x",
  );
});

test("an unknown roaster yields no slug, and fails the BUILD rather than the projection", () => {
  // Null, not a throw: the projection feeds the bean lens too, and a roaster the
  // table has not learned should cost a page rather than the whole view.
  expect(beanPageSlug("Some New Roastery", "Lot 1", [])).toBeNull();
  // It becomes fatal at the step that would otherwise publish a guess.
  expect(() =>
    buildBeanPages([{ ...beans[0]!, slug: null } as never]),
  ).toThrow();
  // And every roaster the corpus actually has IS in the table.
  for (const b of beans)
    expect(
      b.slug,
      `${b.roaster.name} is missing from ROASTER_SLUG`,
    ).toBeTruthy();
});

test("attribution is the union of the documents describing the bag", () => {
  // An extracted bean has no author/based_on of its own — those are recipe
  // fields — so without this a bean page credits nobody.
  const monarch = beans.find((b) => b.slug === "onyx-monarch")!;
  expect(monarch.documents.map((d) => d.slug).sort()).toEqual([
    "onyx-monarch",
    "onyx-monarch-fellow-series-1",
  ]);
  for (const b of beans) {
    expect(b.documents.length, `${b.slug} credits nobody`).toBeGreaterThan(0);
    for (const d of b.documents) expect(d.source_label, b.slug).not.toBe("");
  }
});

test("a bean page names its sources and links its brews", () => {
  const monarch = beans.find((b) => b.slug === "onyx-monarch")!;
  const html = buildBeanPages([monarch])[0]!.html;
  expect(html).toContain(
    '<link rel="canonical" href="https://coffeejson.org/beans/onyx-monarch/" />',
  );
  expect(html).toContain("Onyx Coffee Lab");
  for (const d of monarch.documents)
    expect(html).toContain(`/recipes/${d.slug}/`);
  // Product without offers: the page already names the roaster's listing under
  // Sources, and the node says the same thing to a machine, `sameAs` pointing at
  // it. No offer is asserted, so nothing is claimed for sale here.
  expect(html).toContain('<script type="application/ld+json">');
  expect(html).toContain('"@type":"Product"');
  expect(html).toContain('"url":"https://coffeejson.org/beans/onyx-monarch/"');
  expect(html).toContain(
    '"sameAs":"https://onyxcoffeelab.com/products/monarch"',
  );
  expect(html).not.toContain('"offers"');
});

test("the collision guard fails the build rather than overwriting a page", () => {
  const a = beans[0]!;
  expect(() => buildBeanPages([a, { ...beans[1]!, slug: a.slug }])).toThrow();
});

test("the hub is indexable and the per-bean pages ride the sitemap", () => {
  expect(INDEXABLE_PATHS).toContain("/beans/");
  // The facet is view state, deliberately: a subset of a page is not a page.
  expect(INDEXABLE_PATHS.some((p: string) => p.includes("roaster="))).toBe(
    false,
  );
  expect(beanPagePath("onyx-monarch")).toBe("/beans/onyx-monarch/");
});

test("no generated page directory outlives the document or bag it was written for", () => {
  // `gen` replaces these directories rather than writing over them: an orphan
  // slug is discovered as an MPA input and published with no sitemap entry and no
  // link, so nothing complains.
  const dirs = (p: string) =>
    readdirSync(new URL(`../${p}`, import.meta.url), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  expect(dirs("recipes")).toEqual(corpusPageSlugs().sort());
  expect(dirs("beans")).toEqual(beans.map((b) => b.slug!).sort());
});
