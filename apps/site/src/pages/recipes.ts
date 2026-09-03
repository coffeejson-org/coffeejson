import { decodePayload, MEDIA_TYPE } from "@coffeejson/core";
import type { Filters, View } from "../lib/filter";
import { filtersFromSearch, searchFromFilters, withView } from "../lib/filter";
import { qrPanel, qrSvg } from "../lib/qr";
import { recipesBody, shareable } from "../lib/recipes-body";
import { flash } from "../lib/save";

// The markup lives in `lib/recipes-body.ts`, because the build writes it. This
// file is everything that needs a browser: the URL the reader arrived on, the
// mutable filter state, and the eight listeners.

const app = document.querySelector<HTMLElement>("#app")!;
let filters: Filters = filtersFromSearch(location.search);

function render(): void {
  history.replaceState(
    null,
    "",
    `${location.pathname}${searchFromFilters(filters)}`,
  );
  // The static <title> stays the recipe one — what a crawler reads, and what the
  // canonical URL is — so the lens name is swapped in client-side.
  document.title = `${filters.view === "beans" ? "Beans" : "Recipes"} — CoffeeJSON`;
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
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((t) =>
    t.addEventListener("click", () => {
      const view = t.dataset["view"] as View;
      if (view === filters.view) return;
      filters = withView(filters, view);
      render();
      // render() replaced the DOM — put keyboard focus back on this toggle.
      document
        .querySelector<HTMLButtonElement>(`[data-view="${view}"]`)
        ?.focus();
    }),
  );
  // `[data-kind]` scopes this to the facet chips — the view toggle wears the
  // same pill skin but is a lens, not a filter, and has its own handler below.
  document
    .querySelectorAll<HTMLButtonElement>(".chip[data-kind]")
    .forEach((c) =>
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
      }),
    );
  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      const s = shareable(b.dataset["copy"]!)!;
      await navigator.clipboard.writeText(
        `${location.origin}/r/?d=${s.payload}`,
      );
      flash(b, "Copied");
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-dl]").forEach((b) =>
    b.addEventListener("click", () => {
      const s = shareable(b.dataset["dl"]!)!;
      // Through core, not a local base64url reader: the payload form is the
      // transport's to define, and a download must be the document, not wire bytes.
      const decoded = decodePayload(s.payload);
      if (!decoded.ok) return;
      const blob = new Blob([JSON.stringify(decoded.document, null, 2)], {
        type: MEDIA_TYPE,
      });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: s.file,
      });
      a.click();
      URL.revokeObjectURL(a.href);
    }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-qr]").forEach((b) =>
    b.addEventListener("click", async () => {
      const id = b.dataset["qr"]!;
      const s = shareable(id)!;
      const slot = document.querySelector<HTMLElement>(
        `[data-qr-slot="${id}"]`,
      )!;
      // Encoding is async; refuse a second click until the first has drawn.
      if (b.getAttribute("aria-busy") === "true") return;
      // A disclosure, not a dialog: aria-expanded and aria-controls rather than
      // dialog roles promising a focus trap this does not implement. Escape still
      // closes it, the one dialog affordance that applies to inline content.
      if (slot.innerHTML) {
        closeQr(id);
        return;
      }
      // The short form keeps the code sparse; Copy link and Open keep `?d=`.
      const short = s.qrPath.startsWith("/r/?s=");
      b.setAttribute("aria-busy", "true");
      const svg = await qrSvg(`${location.origin}${s.qrPath}`);
      b.removeAttribute("aria-busy");
      // The null arm is unreachable as the cards stand — two size assertions keep
      // every payload inside level-L capacity — but the alternative is the string
      // "null" in the page if either invariant ever moves.
      slot.innerHTML = qrPanel(svg, {
        fileName: s.file.replace(/\.json$/, ""),
        caption: `Scan to open on a phone${
          short
            ? " (short link — Copy link gives the self-contained form)"
            : " — this code carries the whole document"
        }`,
        tooLargeNoun: "document",
      });
      b.setAttribute("aria-expanded", "true");
      // The QR is meaningful content, not decoration — name it.
      const img = slot.querySelector("svg");
      img?.setAttribute("role", "img");
      img?.setAttribute("aria-label", `QR code linking to ${s.title}`);
    }),
  );

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const open = document.querySelector<HTMLElement>(
      "[data-qr-slot]:not(:empty)",
    );
    if (open) closeQr(open.dataset["qrSlot"]!, true);
  });
}

/** Collapse a QR panel, syncing the toggle's state and optionally its focus. */
function closeQr(id: string, restoreFocus = false): void {
  const slot = document.querySelector<HTMLElement>(`[data-qr-slot="${id}"]`);
  if (slot) slot.innerHTML = "";
  const toggle = document.querySelector<HTMLButtonElement>(`[data-qr="${id}"]`);
  toggle?.setAttribute("aria-expanded", "false");
  if (restoreFocus) toggle?.focus();
}

function renderPreservingFocus(): void {
  const pos =
    document.querySelector<HTMLInputElement>("#q")!.selectionStart ?? 0;
  render();
  const q = document.querySelector<HTMLInputElement>("#q")!;
  q.focus();
  q.setSelectionRange(pos, pos);
}

render();

// The build already wrote the unfiltered view, and it is the same string this
// module would produce for the same filters — so on a bare URL there is nothing
// to render and only behaviour to attach. A URL carrying filter state is the
// case that has to build a different page.
if (location.search) render();
else wire();
