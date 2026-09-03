import QRCode from "qrcode";
import { esc } from "./text.mjs";

// Level M while the payload fits its 2,331-byte capacity, else L, so a dense
// self-contained link still gets a code. Past L at version 40 there is no QR at
// all (byte mode caps at 2,953 bytes) — a fact about the URL, so the result is
// `null`, which every caller must answer for.
export async function qrSvg(url: string): Promise<string | null> {
  for (const errorCorrectionLevel of ["M", "L"] as const) {
    try {
      return await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel,
        margin: 1,
      });
    } catch {
      /* too dense at this level — try the next, then give up */
    }
  }
  return null;
}

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
