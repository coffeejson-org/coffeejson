import { MEDIA_TYPE, decodePayload } from "@coffeejson/core";
import { esc } from "../lib/text.mjs";
import { qrPanel, qrSvg } from "../lib/qr";
import { flash } from "../lib/save";

/**
 * The HTML already carries everything a reader or crawler needs, so this adds only
 * the share controls; if it never runs, the page is still complete. Each share slot
 * carries its own `data-payload`, computed at build time by the same
 * `scopeToRecipe` the viewer uses, so nothing is re-derived in the browser.
 */
function wire(slot: HTMLElement): void {
  const payload = slot.dataset["payload"];
  const slug = slot.dataset["slug"];
  const label = slot.dataset["label"];
  // `i` is present only on a scoped slot; the QR then names that one recipe.
  const i = slot.dataset["i"];
  if (!payload || !slug) return;
  const file = slot.dataset["file"] ?? slug;

  const qrTarget = `${location.origin}/r/?s=${encodeURIComponent(slug)}${i ? `&i=${i}` : ""}`;
  const panelId = `qr-${file}`;
  // A scoped slot is indented under its brew and the publication's is not: without
  // that, a three-brew page reads as four identical offers, one of which differs.
  if (i) slot.classList.add("scoped-share");
  else slot.classList.add("whole-share");
  slot.innerHTML = `
    ${label ? `<p class="muted">${esc(label)}</p>` : ""}
    <div class="row">
      <a class="btn" href="/r/?d=${payload}">Open in the viewer</a>
      <button class="btn btn--ghost" data-qr aria-expanded="false" aria-controls="${esc(panelId)}">QR</button>
      <button class="btn btn--ghost" data-copy>Copy link</button>
      <button class="btn btn--ghost" data-dl>Download</button>
    </div>
    <div id="${esc(panelId)}" data-qr-panel></div>`;

  const panel = slot.querySelector<HTMLElement>("[data-qr-panel]")!;
  const qrBtn = slot.querySelector<HTMLButtonElement>("[data-qr]")!;
  const close = (restoreFocus = false): void => {
    panel.innerHTML = "";
    qrBtn.setAttribute("aria-expanded", "false");
    if (restoreFocus) qrBtn.focus();
  };

  slot.querySelector<HTMLButtonElement>("[data-copy]")!.addEventListener("click", async (e) => {
    await navigator.clipboard.writeText(`${location.origin}/r/?d=${payload}`);
    flash(e.currentTarget as HTMLButtonElement, "Copied");
  });

  slot.querySelector<HTMLButtonElement>("[data-dl]")!.addEventListener("click", () => {
    const result = decodePayload(payload);
    if (!result.ok) return;
    const blob = new Blob([JSON.stringify(result.document, null, 2)],
      { type: MEDIA_TYPE });
    const a = Object.assign(document.createElement("a"),
      { href: URL.createObjectURL(blob), download: `${file}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  });

  qrBtn.addEventListener("click", async () => {
    // The same disclosure contract /recipes uses, and no dialog role for a focus
    // trap that does not exist.
    if (qrBtn.getAttribute("aria-busy") === "true") return;
    if (panel.innerHTML) { close(); return; }
    qrBtn.setAttribute("aria-busy", "true");
    // The short `?s=` form for the reason the cards use it: an enriched document
    // outgrows the code's capacity, and a printed square cannot degrade
    // gracefully. `&i=` keeps a scoped slot's code on its own recipe.
    const svg = await qrSvg(qrTarget);
    qrBtn.removeAttribute("aria-busy");
    panel.innerHTML = qrPanel(svg, {
      fileName: file,
      caption: "Scan to open on a phone (short link — Copy link gives the self-contained form)",
      tooLargeNoun: "document",
    });
    qrBtn.setAttribute("aria-expanded", "true");
    const img = panel.querySelector("svg");
    img?.setAttribute("role", "img");
    img?.setAttribute("aria-label", `QR code linking to this ${i ? "recipe" : "publication"}`);
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && panel.innerHTML) close(true);
  });
}

document.querySelectorAll<HTMLElement>("[data-share-slot]").forEach(wire);
