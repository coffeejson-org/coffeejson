import type { Filters, View } from "../lib/filter";
import { filtersFromSearch, searchFromFilters, withView } from "../lib/filter";
import { recipesBody, settle } from "../lib/recipes-body";

// The markup lives in `lib/recipes-body.ts`, because the build writes it. This
// file is everything that needs a browser: the URL the reader arrived on, the
// mutable filter state, and the listeners.

const app = document.querySelector<HTMLElement>("#app")!;
let filters: Filters = filtersFromSearch(location.search);

function render(): void {
  filters = settle(filters);
  history.replaceState(
    null,
    "",
    `${location.pathname}${searchFromFilters(filters)}`,
  );
  // The static <title> stays the recipe one — what a crawler reads, and what the
  // canonical URL is — so the lens name is swapped in client-side.
  document.title = `${filters.view === "beans" ? "Bags" : "Recipes"} — CoffeeJSON`;
  app.innerHTML = recipesBody(filters);
  wire();
}

function wire(): void {
  const q = document.querySelector<HTMLInputElement>("#q")!;
  q.addEventListener("input", () => {
    filters = { ...filters, q: q.value };
    renderPreservingFocus();
  });
  document.querySelector("#clear")?.addEventListener("click", () => {
    // Clearing filters keeps the lens — the reader chose it, it is not a filter.
    filters = { view: filters.view, q: "", author: null, method: null };
    render();
    document.querySelector<HTMLInputElement>("#q")?.focus();
  });
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((t) => {
    t.addEventListener("click", () => {
      const view = t.dataset["view"] as View;
      if (view === filters.view) return;
      filters = withView(filters, view);
      render();
      // render() replaced the DOM — put keyboard focus back on this toggle.
      document
        .querySelector<HTMLButtonElement>(`[data-view="${view}"]`)
        ?.focus();
    });
  });
  // `[data-kind]` scopes this to the facet chips — the view toggle wears the
  // same pill skin but is a lens, not a filter, and has its own handler above.
  document
    .querySelectorAll<HTMLButtonElement>(".chip[data-kind]")
    .forEach((c) => {
      c.addEventListener("click", () => {
        const kind = c.dataset["kind"] as "author" | "method";
        const value = c.dataset["value"]!;
        filters = {
          ...filters,
          [kind]: filters[kind] === value ? null : value,
        };
        render();
        // render() replaced the DOM — put keyboard focus back on this chip.
        document
          .querySelector<HTMLButtonElement>(
            `.chip[data-kind="${kind}"][data-value="${value}"]`,
          )
          ?.focus();
      });
    });
}

// A row and its line on the overlay light together, and the overlay's caption
// names the line under the pointer. Delegated to the page, so it is attached
// once and survives every render.
const lit = (id: string | undefined, on: boolean): void => {
  if (id === undefined) return;
  const safe = CSS.escape(id);
  for (const el of app.querySelectorAll(
    `.ov-line[data-id="${safe}"], .recipe-row[data-id="${safe}"]`,
  ))
    el.classList.toggle("is-on", on);
  app.querySelector(".overlay")?.classList.toggle("has-on", on);
};
let captionRest: string | null = null;
for (const [type, on] of [
  ["pointerover", true],
  ["pointerout", false],
] as const)
  app.addEventListener(type, (ev) => {
    const target = ev.target as Element;
    const hit = target.closest<SVGElement | HTMLElement>(
      ".ov-hit, .recipe-row",
    );
    lit(hit?.dataset["id"], on);
    const caption = app.querySelector<HTMLElement>("[data-overlay-caption]");
    if (!caption || !hit?.classList.contains("ov-hit")) return;
    captionRest ??= caption.textContent;
    caption.textContent = on
      ? (hit.querySelector("title")?.textContent ?? captionRest)
      : captionRest;
  });

function renderPreservingFocus(): void {
  const pos =
    document.querySelector<HTMLInputElement>("#q")!.selectionStart ?? 0;
  render();
  const q = document.querySelector<HTMLInputElement>("#q")!;
  q.focus();
  q.setSelectionRange(pos, pos);
}

// The build already wrote the unfiltered view, and it is the same string this
// module would produce for the same filters — so on a bare URL there is nothing
// to render and only behavior to attach. A URL carrying filter state is the
// case that has to build a different page.
if (location.search) render();
else wire();
