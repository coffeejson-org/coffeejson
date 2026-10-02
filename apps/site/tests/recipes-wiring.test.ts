// @vitest-environment jsdom

import { beforeAll, expect, test } from "vitest";
import { filtersFromSearch } from "../src/lib/filter";
import { index, recipesBody } from "../src/lib/recipes-body";

// The directory's module attaches behavior to markup the build wrote. These
// drive it the way a reader does — one click — because the failure it once had
// was invisible to every test of the markup: each control was wired twice, so a
// chip toggled on and straight off again and the first click did nothing.

beforeAll(async () => {
  document.body.innerHTML = `<main id="app">${recipesBody(filtersFromSearch(""))}</main>`;
  await import("../src/pages/recipes");
});

const cards = () => document.querySelectorAll(".recipe-row").length;
const chip = (kind: string) =>
  document.querySelector<HTMLButtonElement>(`.chip[data-kind="${kind}"]`)!;

test("one click on a filter chip filters", () => {
  expect(cards()).toBe(index.length);
  const method = chip("method").dataset["value"]!;
  chip("method").click();

  const pressed = document.querySelector<HTMLButtonElement>(
    `.chip[data-kind="method"][data-value="${method}"]`,
  )!;
  expect(pressed.getAttribute("aria-pressed")).toBe("true");
  const expected = index.filter((e) => e.method === method).length;
  expect(expected).toBeLessThan(index.length);
  expect(cards()).toBe(expected);
  expect(document.querySelector(".count")?.textContent).toBe(
    `${expected} of ${index.length} recipes`,
  );
  expect(location.search).toBe(`?method=${method}`);
});

test("a second click on the same chip clears it", () => {
  const on = document.querySelector<HTMLButtonElement>(
    '.chip[data-kind="method"][aria-pressed="true"]',
  )!;
  on.click();
  expect(cards()).toBe(index.length);
  expect(location.search).toBe("");
});

test("switching lens keeps one listener per control", () => {
  document.querySelector<HTMLButtonElement>('[data-view="beans"]')!.click();
  expect(document.querySelector("h1")?.textContent).toBe("Bags");
  document.querySelector<HTMLButtonElement>('[data-view="recipes"]')!.click();
  chip("author").click();
  expect(
    document.querySelectorAll('.chip[data-kind="author"][aria-pressed="true"]')
      .length,
  ).toBe(1);
  expect(cards()).toBeLessThan(index.length);
});

// An author with no bag is not a filter the bag lens can show: carried across,
// it emptied the list with no chip lit to say why.
test("switching lens drops an author the other lens has no chip for", async () => {
  const { settle } = await import("../src/lib/recipes-body");
  expect(
    settle({ view: "beans", q: "", author: "james-hoffmann", method: null })
      .author,
  ).toBeNull();
  // A roaster who is also an author survives the switch, as before.
  expect(
    settle({ view: "beans", q: "", author: "onyx-coffee-lab", method: null })
      .author,
  ).toBe("onyx-coffee-lab");

  // And through the page: pick the author, switch to bags, see every bag.
  for (const on of document.querySelectorAll<HTMLButtonElement>(
    '.chip[aria-pressed="true"][data-kind]',
  ))
    on.click();
  document
    .querySelector<HTMLButtonElement>(
      '.chip[data-kind="author"][data-value="james-hoffmann"]',
    )!
    .click();
  document.querySelector<HTMLButtonElement>('[data-view="beans"]')!.click();
  expect(location.search).toBe("?view=beans");
  expect(document.querySelector(".count")?.textContent).toMatch(
    /^(\d+) of \1 bags$/,
  );
  expect(document.querySelector(".empty")).toBeNull();
});

test("a chip says how many it would show, and cannot lead to none", () => {
  for (const on of document.querySelectorAll<HTMLButtonElement>(
    '.chip[aria-pressed="true"][data-kind]',
  ))
    on.click();
  document.querySelector<HTMLButtonElement>('[data-view="recipes"]')!.click();

  // Every chip's count is what clicking it shows.
  const first = chip("method");
  const promised = Number(first.querySelector(".num")!.textContent);
  first.click();
  expect(cards()).toBe(promised);

  // Beside that method, an author with no such recipe is disabled, not a trap.
  const method = location.search.replace("?method=", "");
  const authors = [
    ...document.querySelectorAll<HTMLButtonElement>(
      '.chip[data-kind="author"]',
    ),
  ];
  for (const a of authors) {
    const n = index.filter(
      (e) =>
        e.method === method &&
        e.author.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-") ===
          a.dataset["value"],
    ).length;
    expect(
      Number(a.querySelector(".num")!.textContent),
      a.dataset["value"],
    ).toBe(n);
    expect(a.disabled, a.dataset["value"]).toBe(n === 0);
  }
  expect(authors.some((a) => a.disabled)).toBe(true);
});

test("the overlay draws one line per schedule in the list, and none for a list without two", () => {
  const lines = document.querySelectorAll(".overlay .ov-line").length;
  const shown = [...document.querySelectorAll<HTMLElement>(".recipe-row")].map(
    (r) => r.dataset["id"],
  );
  const timed = index.filter((e) => shown.includes(e.id) && e.curve).length;
  expect(lines).toBe(timed >= 2 ? timed : 0);
});
