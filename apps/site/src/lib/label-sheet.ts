import type { CoffeeJSONDocument } from "@coffeejson/core";
import { decodePayload } from "@coffeejson/core";
import { compressPayload } from "./compress-payload";
import { labelDocument } from "./label-document";
import type { QrCode } from "./qr";
import { qrCode } from "./qr";
import type { PaperId, SheetLayout } from "./sheet-layout";
import { moduleMm, PAPERS, sheetLayout } from "./sheet-layout";
import { esc, plural } from "./text.mjs";
import { validateDocument } from "./validate";

/** The viewer a printed code opens. A printed code cannot change, so every label uses this one. */
export const LABEL_VIEWER = "https://coffeejson.org/r/";
/** Below this printed width a module is too fine for a phone camera on a bag. */
export const MIN_MODULE_MM = 0.35;
/** The blank margin a printed code keeps, in modules. */
const QUIET = 4;
/** The strip under a code for its roast date. */
const TEXT_MM = 5;
/** The date line's type size, and how wide one of its characters sets. */
const TEXT_SIZE_MM = 3;
const MONO_ADVANCE = 0.6;

/**
 * The type size the date line is set in: `TEXT_SIZE_MM` where that fits, and
 * smaller on a label too narrow for it, so the line never crosses into the
 * next label. A monospace character is `MONO_ADVANCE` of its size wide.
 */
export const textSizeMm = (labelMm: number, text: string): number =>
  text
    ? Math.min(TEXT_SIZE_MM, (labelMm * 0.92) / (MONO_ADVANCE * text.length))
    : 0;

export interface LabelSettings {
  /** The batch this sheet is for, as an ISO day. */
  roastDate: string;
  /** A sheet used for every batch states no date. */
  reuse: boolean;
  paper: PaperId;
  labelMm: number;
  gapMm: number;
  marginMm: number;
}

export const defaultLabelSettings = (): LabelSettings => ({
  roastDate: "",
  reuse: false,
  paper: "a4",
  labelMm: 40,
  gapMm: 3,
  marginMm: 10,
});

export interface LabelBuild {
  url: string;
  compressed: boolean;
  leftOut: string[];
  /** `null` when the link is too long for any QR code, or the document is not valid. */
  qr: QrCode | null;
  /** Why the label's document is not a valid one; empty when it is. */
  problems: string[];
  layout: SheetLayout;
  /** The printed width of one module; 0 when there is no code. */
  moduleMm: number;
  /** The line under each code; "" for none. */
  text: string;
  paper: PaperId;
  labelMm: number;
}

/** Everything a sheet needs, or `null` when the document has no bean. */
export async function buildLabel(
  doc: CoffeeJSONDocument,
  s: LabelSettings,
): Promise<LabelBuild | null> {
  const label = labelDocument(doc, {
    roastDate: s.reuse || !s.roastDate ? null : s.roastDate,
  });
  if (!label) return null;
  const { payload, compressed } = await compressPayload(label.doc);
  const url = `${LABEL_VIEWER}?d=${payload}`;
  // A code is only worth printing if a reader accepts what it carries. A
  // document past the share-link size cap can compress small enough to draw
  // and still be refused on the scan, so the sheet asks the reference decoder first.
  // The page's document was valid; the sheet's date is the one member this
  // build adds, and a date input can hold a year the format does not allow.
  const problems = validateDocument(label.doc).map(
    (i) => `${i.path} ${i.message}`,
  );
  const qr =
    problems.length === 0 && decodePayload(payload).ok
      ? await qrCode(url, QUIET)
      : null;
  const text = s.reuse || !s.roastDate ? "" : `Roasted ${s.roastDate}`;
  return {
    url,
    compressed,
    leftOut: label.leftOut,
    qr,
    problems,
    layout: sheetLayout({
      paper: s.paper,
      labelMm: s.labelMm,
      textMm: text ? TEXT_MM : 0,
      gapMm: s.gapMm,
      marginMm: s.marginMm,
    }),
    moduleMm: qr ? moduleMm(s.labelMm, qr.modules, QUIET) : 0,
    text,
    paper: s.paper,
    labelMm: s.labelMm,
  };
}

const r2 = (n: number): string => String(Math.round(n * 100) / 100);

/**
 * The sheet as one SVG whose user unit is a millimeter, so the same markup is
 * the on-screen preview (scaled by CSS) and the printed page (at its own size).
 * The code is drawn once as a symbol and placed once per label.
 */
export function sheetSvg(b: LabelBuild, symbolId = "label-qr"): string {
  if (!b.qr) return "";
  const { w, h } = PAPERS[b.paper];
  const inner = /<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*)<\/svg>/.exec(
    b.qr.svg,
  );
  if (!inner) return "";
  const guides = b.layout.cells
    .map(
      (c) =>
        `<rect x="${r2(c.x)}" y="${r2(c.y)}" width="${r2(b.layout.cellW)}" height="${r2(b.layout.cellH)}" fill="none" stroke="#999" stroke-width="0.1"/>`,
    )
    .join("");
  // Sized to the label. At the full size the line is wider than a small label
  // and would print across the cut guide into its neighbor.
  const size = textSizeMm(b.labelMm, b.text);
  const labels = b.layout.cells
    .map(
      (c) =>
        `<use href="#${symbolId}" x="${r2(c.x)}" y="${r2(c.y)}" width="${r2(b.labelMm)}" height="${r2(b.labelMm)}"/>${
          b.text
            ? `<text x="${r2(c.x + b.labelMm / 2)}" y="${r2(c.y + b.labelMm + size + 0.2)}" text-anchor="middle" font-size="${r2(size)}" font-family="'Commit Mono', ui-monospace, monospace" fill="#000">${esc(b.text)}</text>`
            : ""
        }`,
    )
    .join("");
  // `crispEdges` is on the library's own root tag, which the symbol replaces.
  // Without it antialiasing can leave hairline seams between rows of modules.
  return `<svg xmlns="http://www.w3.org/2000/svg" class="label-sheet" viewBox="0 0 ${w} ${h}" data-w="${w}" data-h="${h}"><defs><symbol id="${symbolId}" viewBox="${inner[1]}" shape-rendering="crispEdges">${inner[2]}</symbol></defs><rect width="${w}" height="${h}" fill="#fff"/>${guides}${labels}</svg>`;
}

/** What the panel says about the code, in sentences a roaster can act on. */
export function labelStatus(b: LabelBuild): { html: string; ok: boolean } {
  const out = b.leftOut.length
    ? `<p class="muted">Left out of the code: ${b.leftOut.map((m) => `<code>${esc(m)}</code>`).join(", ")}. The label already says it in words.</p>`
    : "";
  if (b.problems.length)
    return {
      ok: false,
      html: `<div class="error">The label's document is not valid: ${b.problems.map((p) => esc(p)).join("; ")}.</div>${out}`,
    };
  if (!b.qr)
    return {
      ok: false,
      html: `<div class="error">This document is too large for a QR code. Remove a recipe, or shorten its steps.</div>${out}`,
    };
  const n = b.layout.cells.length;
  if (!n)
    return {
      ok: false,
      html: `<div class="error">A label this size does not fit the page inside its margins.</div>${out}`,
    };
  const fine = b.moduleMm < MIN_MODULE_MM;
  return {
    ok: true,
    html: `<p class="muted">${plural(n, "label")} of ${r2(b.labelMm)} mm on one ${esc(PAPERS[b.paper].name)} page. The link is ${b.url.length} characters${b.compressed ? ", compressed" : ""}; the code is version ${b.qr.version}, and one of its squares prints ${r2(b.moduleMm)} mm wide.</p>${
      fine
        ? `<div class="error">That is too fine to scan reliably on a bag. Use a larger label, or remove a recipe.</div>`
        : ""
    }${out}`,
  };
}

const today = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// The panel is rebuilt whenever the form changes shape, so this module keeps
// what the reader set, and the DOM does not.
const settings = defaultLabelSettings();
let dateTouched = false;
// The bean's own roast date when the sheet's was last settled. A picked date
// is for one batch, so it stops applying when the bean's date changes.
let beanDate: string | undefined;
let open = false;
let seq = 0;
let current: LabelBuild | null = null;

const clamp = (v: string, lo: number, hi: number, fallback: number): number => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n)
    ? Math.min(hi, Math.max(lo, n))
    : fallback;
};

export function labelPanelHtml(): string {
  const numField = (
    label: string,
    key: string,
    v: number,
    lo: number,
    hi: number,
  ) =>
    `<label class="gen-field"><span class="muted">${label}</span>
      <input class="field field--sm" type="number" inputmode="decimal" step="any" min="${lo}" max="${hi}" data-lk="${key}" value="${v}"></label>`;
  return `<details class="label-panel"${open ? " open" : ""}>
    <summary>Print labels</summary>
    <p class="muted">A sheet of QR labels for this coffee's bags. Each code carries the coffee and its recipes.</p>
    <label class="gen-field"><span class="muted">Roast date of this batch</span>
      <input class="field" type="date" data-lk="roastDate" value="${esc(settings.roastDate)}"${settings.reuse ? " disabled" : ""}></label>
    <label class="gen-field label-check"><input type="checkbox" data-lk="reuse"${settings.reuse ? " checked" : ""}>
      One sheet for every batch (the code states no roast date)</label>
    <label class="gen-field"><span class="muted">Paper</span>
      <select class="field" data-lk="paper">${(Object.keys(PAPERS) as PaperId[])
        .map(
          (id) =>
            `<option value="${id}"${settings.paper === id ? " selected" : ""}>${PAPERS[id].name}</option>`,
        )
        .join("")}</select></label>
    <div class="row">
      ${numField("Label (mm)", "labelMm", settings.labelMm, 25, 80)}
      ${numField("Gap (mm)", "gapMm", settings.gapMm, 0, 20)}
      ${numField("Margin (mm)", "marginMm", settings.marginMm, 0, 30)}
    </div>
    <div data-label-status aria-live="polite"></div>
    <div class="label-preview" data-label-preview></div>
    <p><button class="btn" data-label-print disabled>Print the sheet</button></p>
    <p class="muted">Print at 100% scale. “Fit to page” changes the label size.</p>
  </details>`;
}

/** Draw the panel into `root` and wire its controls. `getDoc` is read on every change. */
export function mountLabelPanel(
  root: HTMLElement,
  getDoc: () => CoffeeJSONDocument | null,
): void {
  root.innerHTML = labelPanelHtml();
  const details = root.querySelector<HTMLDetailsElement>("details")!;
  details.addEventListener("toggle", () => {
    if (details.open === open) return;
    open = details.open;
    if (open) void updateLabelPanel(root, getDoc());
  });
  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-lk]")
    .forEach((el) => {
      el.addEventListener(
        el.tagName === "SELECT" || el.type === "checkbox" || el.type === "date"
          ? "change"
          : "input",
        () => {
          switch (el.dataset["lk"]) {
            case "roastDate":
              settings.roastDate = el.value;
              dateTouched = true;
              break;
            case "reuse":
              settings.reuse = (el as HTMLInputElement).checked;
              root.querySelector<HTMLInputElement>(
                '[data-lk="roastDate"]',
              )!.disabled = settings.reuse;
              break;
            case "paper":
              settings.paper = el.value as PaperId;
              break;
            case "labelMm":
              settings.labelMm = clamp(el.value, 25, 80, settings.labelMm);
              break;
            case "gapMm":
              settings.gapMm = clamp(el.value, 0, 20, settings.gapMm);
              break;
            case "marginMm":
              settings.marginMm = clamp(el.value, 0, 30, settings.marginMm);
              break;
          }
          void updateLabelPanel(root, getDoc());
        },
      );
      // A number out of range is clamped, and the box says what the sheet
      // uses. On `change`, not `input`, because rewriting a field on every
      // keystroke would replace what the reader is still typing.
      if (el.type === "number")
        el.addEventListener("change", () => {
          const key = el.dataset["lk"] as "labelMm" | "gapMm" | "marginMm";
          el.value = String(settings[key]);
        });
    });
  root
    .querySelector<HTMLButtonElement>("[data-label-print]")!
    .addEventListener("click", () => {
      if (current) printSheet(current);
    });
}

/** Forget a picked sheet date. The next update takes the bean's own, or today. */
export function resetLabelDate(): void {
  dateTouched = false;
}

/** Redraw the panel's status and preview for `doc`; hide it when there is no bean. */
export async function updateLabelPanel(
  root: HTMLElement,
  doc: CoffeeJSONDocument | null,
): Promise<void> {
  // Counted before any return, so a build still in flight for an older
  // document cannot paint after this call decided there is nothing to show.
  const mine = ++seq;
  const bean = doc?.beans?.[0];
  root.hidden = !bean;
  if (!doc || !bean) {
    current = null;
    return;
  }
  if (bean.roast_date !== beanDate) {
    beanDate = bean.roast_date;
    dateTouched = false;
  }
  // Until the reader picks a date, the sheet follows the bean's own, else today.
  if (!dateTouched) {
    settings.roastDate = bean.roast_date ?? today();
    const input = root.querySelector<HTMLInputElement>('[data-lk="roastDate"]');
    if (input && input.value !== settings.roastDate)
      input.value = settings.roastDate;
  }
  // A closed panel shows nothing, so the sheet is not built on every
  // keystroke. Opening the panel builds it.
  if (!open) {
    current = null;
    return;
  }
  const statusEl = root.querySelector<HTMLElement>("[data-label-status]")!;
  const previewEl = root.querySelector<HTMLElement>("[data-label-preview]")!;
  const printBtn = root.querySelector<HTMLButtonElement>("[data-label-print]")!;
  const fail = (message: string) => {
    current = null;
    statusEl.innerHTML = `<div class="error">${esc(message)}</div>`;
    previewEl.innerHTML = "";
    printBtn.disabled = true;
  };
  let build: LabelBuild | null;
  try {
    // A copy, because the reader can change a setting while this build runs.
    build = await buildLabel(doc, { ...settings });
  } catch {
    if (mine === seq) fail("The label could not be built in this browser.");
    return;
  }
  // A slower build for an older keystroke must not paint over a newer one.
  if (mine !== seq || !build) return;
  const status = labelStatus(build);
  const svg = status.ok ? sheetSvg(build) : "";
  // A code with no drawing means the QR library's markup is not the shape this
  // module reads. The panel says so and disables printing, because the button
  // would otherwise print a blank page.
  if (status.ok && !svg) {
    fail("The code could not be drawn.");
    return;
  }
  current = build;
  statusEl.innerHTML = status.html;
  previewEl.innerHTML = svg;
  printBtn.disabled = !status.ok;
}

/** Print the sheet alone, at its own paper size, and put the page back after. */
export function printSheet(b: LabelBuild): void {
  const { w, h, cssSize } = PAPERS[b.paper];
  // A browser that never fired `afterprint` leaves the last sheet behind, and
  // two symbols with one id resolve to the first, which is the old coffee's code.
  document.getElementById("label-print")?.remove();
  document.getElementById("label-print-page")?.remove();
  const host = document.createElement("div");
  host.id = "label-print";
  host.innerHTML = sheetSvg(b, "label-qr-print");
  const svg = host.querySelector("svg");
  svg?.setAttribute("width", `${w}mm`);
  svg?.setAttribute("height", `${h}mm`);
  const page = document.createElement("style");
  page.id = "label-print-page";
  page.textContent = `@page { size: ${cssSize}; margin: 0; }`;
  document.body.append(host);
  document.head.append(page);
  document.documentElement.classList.add("printing-labels");
  const done = () => {
    host.remove();
    page.remove();
    document.documentElement.classList.remove("printing-labels");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

/** For tests. Puts the module's remembered settings back to their defaults. */
export function resetLabelSettings(): void {
  Object.assign(settings, defaultLabelSettings());
  dateTouched = false;
  beanDate = undefined;
  open = false;
  current = null;
}
