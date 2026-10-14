import QRCode from "qrcode";
import { esc } from "./text.mjs";

export interface QrCode {
  svg: string;
  /** The symbol's side in modules, without the quiet zone. */
  modules: number;
  version: number;
  level: "M" | "L";
}

// Level M while the payload fits its 2,331-byte capacity, else L, so a dense
// self-contained link still gets a code. Past L at version 40 there is no QR at
// all (byte mode caps at 2,953 bytes) — a fact about the URL, so the result is
// `null`, which every caller must handle. `margin` is the quiet zone in
// modules: 1 on a screen, where the page around the code is already blank, and
// 4 in print, which is what the symbology asks for.
export async function qrCode(url: string, margin = 1): Promise<QrCode | null> {
  for (const level of ["M", "L"] as const) {
    try {
      const { modules, version } = QRCode.create(url, {
        errorCorrectionLevel: level,
      });
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: level,
        margin,
      });
      return { svg, modules: modules.size, version, level };
    } catch {
      /* too dense at this level — try the next, then give up */
    }
  }
  return null;
}

/**
 * A link as a QR drawn at build time, for a page whose body is prerendered: one
 * path in `currentColor`, so the code takes the page's text color. Level M,
 * because a prerendered link is one the site chose. Throws when the link is too
 * long for it, which fails the build rather than shipping a page without its code.
 */
export function inlineQrSvg(text: string, label: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
  return `<svg class="qr" viewBox="-2 -2 ${n + 4} ${n + 4}" role="img" aria-label="${esc(label)}" shape-rendering="crispEdges"><path d="${d}"/></svg>`;
}

export const qrSvg = async (url: string): Promise<string | null> =>
  (await qrCode(url))?.svg ?? null;

/** The quiet zone of a downloaded or printed code, in modules. */
export const PRINT_QUIET = 4;
/** The least width a downloaded PNG is drawn at, in pixels. */
const PNG_MIN_PX = 1024;

/**
 * Pixels per module in a downloaded PNG. A whole number, so every module edge
 * falls on a pixel edge and none is antialiased.
 */
export const pngScale = (modules: number): number =>
  Math.max(1, Math.ceil(PNG_MIN_PX / (modules + 2 * PRINT_QUIET)));

export interface QrFiles {
  svg: string;
  /** A data URL, or `null` where the browser could not draw one. */
  png: string | null;
}

/**
 * The code as files to download. A file is placed in a design or printed, so
 * it keeps the print quiet zone and is black on white, whatever the page shows.
 * `null` when no code can hold the link.
 */
export async function qrFiles(url: string): Promise<QrFiles | null> {
  const code = await qrCode(url, PRINT_QUIET);
  if (!code) return null;
  let png: string | null = null;
  try {
    png = await QRCode.toDataURL(url, {
      errorCorrectionLevel: code.level,
      margin: PRINT_QUIET,
      scale: pngScale(code.modules),
    });
  } catch {
    /* no canvas to draw on, so the SVG is the one download */
  }
  return { svg: code.svg, png };
}

/**
 * The panel a QR button opens — the code, its caption, and its downloads. `svg`
 * is `qrSvg`'s result and `files` is `qrFiles`'s, so `null` stands for a
 * document no code can hold. The link still works, and the panel says so
 * instead of showing nothing.
 */
export const qrPanel = (
  svg: string | null,
  files: QrFiles | null,
  {
    fileName,
    caption,
    tooLargeNoun,
  }: { fileName: string; caption: string; tooLargeNoun: string },
): string =>
  svg === null || files === null
    ? `<p class="muted">This ${esc(tooLargeNoun)} is too large to fit in a QR code — use Copy link instead.</p>`
    : `<div class="qr-panel">${svg}<p class="muted">${esc(caption)}</p>
        <a class="btn btn--ghost" download="${esc(fileName)}-qr.svg"
           href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(files.svg)}">Download SVG</a>${
             files.png
               ? ` <a class="btn btn--ghost" download="${esc(fileName)}-qr.png" href="${files.png}">Download PNG</a>`
               : ""
}</div>`;
