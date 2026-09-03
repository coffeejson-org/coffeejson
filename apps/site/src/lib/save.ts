import type { DecodedDocument } from "@coffeejson/core";
import { encodePayload, MEDIA_TYPE, normalize } from "@coffeejson/core";
import registry from "../../../../registries/implementations.json";
import { qrPanel, qrSvg } from "./qr";
import { esc } from "./text.mjs";

export const shareUrlFor = (doc: unknown): string =>
  `${location.origin}/r/?d=${encodePayload(doc)}`;

/** What the document is called, read the one way a decoded document may be read. */
const docTitle = (doc: DecodedDocument): string | null => {
  const n = normalize(doc);
  return n.recipes[0]?.title ?? n.beans[0]?.name ?? null;
};

const slugFor = (doc: DecodedDocument): string =>
  (docTitle(doc) ?? "coffeejson")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "coffeejson";

/**
 * What this document is, for the copy that names it. `beans` and `recipes`
 * are independent, so a document can carry only a bag, and a publication can
 * carry several recipes; "this recipe" would misname both.
 */
const noun = (doc: DecodedDocument): string => {
  const recipes = doc.recipes?.length ?? 0;
  if (recipes > 1) return "publication";
  return recipes ? "recipe" : doc.beans?.length ? "bean" : "document";
};

/** The button row every share surface uses — the panel and the per-card variant alike. */
const shareRow = (compact: boolean): string => `<div class="row">
      <button class="btn" data-save="file">Save file</button>
      ${compact ? "" : `<button class="btn btn--ghost" data-save="json">Copy JSON</button>`}
      <button class="btn btn--ghost" data-save="link">Copy link</button>
      ${compact ? "" : `<button class="btn btn--ghost" data-save="share">Share</button>`}
      <button class="btn btn--ghost" data-save="qr">QR</button>
    </div>
    <div data-qr-slot></div>`;

export function saveCta(
  doc: DecodedDocument,
  opts: { prominent: boolean; variant?: "panel" | "row"; label?: string },
): string {
  // The `row` variant is a per-card share: the same buttons and the same
  // `wireSaveCta`, without panel furniture that would repeat under every card.
  if (opts.variant === "row") {
    return `<div class="scoped-share">
      ${opts.label ? `<p class="muted">${esc(opts.label)}</p>` : ""}
      ${shareRow(true)}
    </div>`;
  }
  // Only implementations that READ something can receive this link: the registry
  // lists producers too, and a handoff to one cannot open what the reader holds.
  const openIn = registry.implementations
    .filter((i) => i.reads.length)
    .map(
      (i) =>
        `<li><a href="${esc(i.url)}" rel="noopener">${esc(i.name)}</a>
       <span class="muted">(${i.platforms.join(", ")})${"note" in i && i.note ? " — " + esc(String(i.note)) : ""}</span></li>`,
    )
    .join("");
  const n = noun(doc);
  return `<section class="card">
    ${
      opts.prominent
        ? `<h2>Enjoyed it? Save this ${n} to ${n === "recipe" ? "brew it again" : "keep it"}</h2>`
        : `<h2>Save this ${n}</h2>`
    }
    ${shareRow(false)}
    <p class="muted">The ${n} is the data in this page’s link — it works with any
    app that reads CoffeeJSON, no account anywhere.</p>
    <details><summary>Where you can open this</summary><ul>${openIn}</ul></details>
  </section>`;
}

export function wireSaveCta(root: HTMLElement, doc: DecodedDocument): void {
  const url = shareUrlFor(doc);
  const json = JSON.stringify(doc, null, 2);
  root.querySelectorAll<HTMLButtonElement>("[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      // Every arm below awaits something, so refuse the second click until the
      // first settles: a slow share sheet otherwise opens twice.
      if (btn.getAttribute("aria-busy") === "true") return;
      btn.setAttribute("aria-busy", "true");
      try {
        await runSave(btn, root, doc, url, json);
      } finally {
        btn.removeAttribute("aria-busy");
      }
    });
  });
}

async function runSave(
  btn: HTMLButtonElement,
  root: HTMLElement,
  doc: DecodedDocument,
  url: string,
  json: string,
): Promise<void> {
  switch (btn.dataset["save"]) {
    case "file": {
      const blob = new Blob([json], { type: MEDIA_TYPE });
      const a = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob),
        download: `${slugFor(doc)}.json`,
      });
      a.click();
      URL.revokeObjectURL(a.href);
      break;
    }
    case "json":
      await navigator.clipboard.writeText(json);
      flash(btn, "Copied");
      break;
    case "link":
      await navigator.clipboard.writeText(url);
      flash(btn, "Copied");
      break;
    case "share":
      if (navigator.share)
        await navigator.share({ title: docTitle(doc) ?? "CoffeeJSON", url });
      else {
        await navigator.clipboard.writeText(url);
        flash(btn, "Link copied");
      }
      break;
    case "qr": {
      const slot = root.querySelector<HTMLElement>("[data-qr-slot]")!;
      if (slot.innerHTML) {
        slot.innerHTML = "";
        break;
      }
      slot.innerHTML = qrPanel(await qrSvg(url), {
        fileName: slugFor(doc),
        caption: "Scan to open this recipe",
        tooLargeNoun: noun(doc),
      });
      break;
    }
  }
}

/**
 * Swap a button's label for a moment, pinning the width to whichever label is
 * wider: letting it shrink slides every sibling in the flex row left and back.
 */
export function flash(btn: HTMLButtonElement, text: string): void {
  const original = btn.textContent;
  btn.style.minWidth = `${btn.getBoundingClientRect().width}px`;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = original;
  }, 1200);
}
