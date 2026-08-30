import { expect, test } from "vitest";
import { slugify } from "../src/lib/text.mjs";
import { filterBeans, filterEntries, filtersFromSearch, searchFromFilters, withView }
  from "../src/lib/filter";
import type { BeanEntry, Filters, IndexEntry } from "../src/lib/filter";

const e = (slug: string, title: string, author: string, method: string): IndexEntry =>
  ({ slug, id: slug, siblings: 1, title, author: { name: author }, method, methodLabel: method,
     coffee: "", brew: "", ratio: "", temp: "", totalTime: "", stepCount: 0,
     attribution: { source_url: "", source_label: "", transcribed: "" }, payload: "" });

const f = (over: Partial<Filters> = {}): Filters =>
  ({ view: "recipes", q: "", author: null, method: null, ...over });

const entries = [
  e("a", "4:6 Method", "Tetsu Kasuya", "pour_over"),
  e("b", "Ultimate V60", "James Hoffmann", "pour_over"),
  e("c", "Monarch Espresso", "Onyx Coffee Lab", "espresso"),
];

test("text query matches title, author, and method, case-insensitively", () => {
  expect(filterEntries(entries, f({ q: "hoffmann" }))).toHaveLength(1);
  expect(filterEntries(entries, f({ q: "ESPRESSO" }))).toHaveLength(1);
  expect(filterEntries(entries, f({ q: "4:6" }))[0]!.slug).toBe("a");
});
test("chips filter by slugified author and by method id", () => {
  expect(filterEntries(entries, f({ author: "onyx-coffee-lab" }))).toHaveLength(1);
  expect(filterEntries(entries, f({ method: "pour_over" }))).toHaveLength(2);
});
test("URL state round-trips", () => {
  const state = { view: "beans" as const, q: "v60", author: "james-hoffmann", method: "pour_over" };
  expect(filtersFromSearch(searchFromFilters(state))).toEqual(state);
  expect(searchFromFilters(f())).toBe("");
});
test("the recipe view is the default and stays out of the URL", () => {
  expect(searchFromFilters(f({ q: "v60" }))).toBe("?q=v60");
  expect(searchFromFilters(f({ view: "beans" }))).toBe("?view=beans");
  expect(filtersFromSearch("").view).toBe("recipes");
  expect(filtersFromSearch("?view=nonsense").view).toBe("recipes");
});
test("slugify", () => { expect(slugify("Onyx Coffee Lab")).toBe("onyx-coffee-lab"); });

const b = (name: string, roaster: string, over: Partial<BeanEntry> = {}): BeanEntry =>
  ({ key: `${slugify(roaster)}/${slugify(name)}`, name, roaster: { name: roaster },
     origin: "", process: "", roast: "", notes: "", recipes: [], payload: "", ...over });

const beans = [
  b("Monarch", "Onyx Coffee Lab", { origin: "Colombia + Ethiopia", notes: "dark chocolate · molasses" }),
  b("Geometry", "Onyx Coffee Lab", { origin: "Colombia + Ethiopia" }),
  b("Kilimanjaro", "Bench Roasters", { origin: "Tanzania", notes: "citrus" }),
];

test("bean query matches name, roaster, origin, and roaster notes", () => {
  expect(filterBeans(beans, f({ q: "monarch" }))).toHaveLength(1);
  expect(filterBeans(beans, f({ q: "TANZANIA" }))[0]!.name).toBe("Kilimanjaro");
  expect(filterBeans(beans, f({ q: "molasses" }))[0]!.name).toBe("Monarch");
  expect(filterBeans(beans, f({ q: "onyx" }))).toHaveLength(2);
});
test("the author chip filters beans by slugified roaster — the same chip slug space", () => {
  expect(filterBeans(beans, f({ author: "onyx-coffee-lab" }))).toHaveLength(2);
  expect(filterBeans(beans, f({ author: "bench-roasters" }))).toHaveLength(1);
});
test("method is inert over bags — a stale one never hides a card", () => {
  expect(filterBeans(beans, f({ method: "espresso" }))).toHaveLength(3);
});
test("switching view carries q and the roaster chip, and drops method", () => {
  const from = f({ q: "onyx", author: "onyx-coffee-lab", method: "pour_over" });
  expect(withView(from, "beans")).toEqual(f({ view: "beans", q: "onyx", author: "onyx-coffee-lab" }));
  expect(searchFromFilters(withView(from, "beans"))).toBe("?view=beans&q=onyx&author=onyx-coffee-lab");
  expect(withView(withView(from, "beans"), "recipes").method).toBeNull();
});
