import { esc } from "./text.mjs";

const TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function tokens(line: string): string {
  let out = "";
  let at = 0;
  for (const m of line.matchAll(TOKEN)) {
    out += esc(line.slice(at, m.index));
    if (m[1] === undefined) out += `<span class="n">${esc(m[0])}</span>`;
    else if (m[2] !== undefined)
      out += `<span class="k">${esc(m[1])}</span>${esc(m[2])}`;
    else out += esc(m[1]);
    at = m.index + m[0].length;
  }
  return out + esc(line.slice(at));
}

/**
 * A JSON file as one span per line, so a line can be lit on its own. Keys and
 * numbers are marked; a line holding one element of a `steps` array carries
 * that element's index. The text is the file's, byte for byte — indentation
 * moves into `--i` only so a wrapped line can hang under itself.
 */
export function jsonLines(text: string): string {
  let stepsIndent: number | null = null;
  let step = 0;
  return text
    .split("\n")
    .map((raw) => {
      const indent = raw.length - raw.trimStart().length;
      const body = raw.slice(indent);
      let attr = "";
      if (stepsIndent === null) {
        if (/^"steps"\s*:\s*\[$/.test(body)) {
          stepsIndent = indent;
          step = 0;
        }
      } else if (indent <= stepsIndent) stepsIndent = null;
      else if (body.startsWith("{")) attr = ` data-step="${step++}"`;
      return `<span class="ln"${attr} style="--i:${indent}">${tokens(body)}</span>`;
    })
    .join("");
}
