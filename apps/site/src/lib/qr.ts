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
// `null`, which every caller must answer for. `margin` is the quiet zone in
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

export const qrSvg = async (url: string): Promise<string | null> =>
  (await qrCode(url))?.svg ?? null;

/**
 * The panel a QR button opens — the code, its caption, and a download. `svg` is
 * `qrSvg`'s result, so `null` is the answer for a document no code can hold: the
 * link still works, and saying so beats an empty panel.
 */
export const qrPanel = (
  svg: string | null,
  {
    fileName,
    caption,
    tooLargeNoun,
  }: { fileName: string; caption: string; tooLargeNoun: string },
): string =>
  svg === null
    ? `<p class="muted">This ${esc(tooLargeNoun)} is too large to fit in a QR code — use Copy link instead.</p>`
    : `<div class="qr-panel">${svg}<p class="muted">${esc(caption)}</p>
        <a class="btn btn--ghost" download="${esc(fileName)}-qr.svg"
           href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">Download SVG</a></div>`;
