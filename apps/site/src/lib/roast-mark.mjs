// A `.mjs` with a `.d.mts` beside it, matching `footer.mjs`: the page modules
// are TypeScript built by vite, and `tools/gen.mjs` is plain Node.

import { defaultLabels, vocabularyLabel } from "@coffeejson/core";
import { esc } from "./text.mjs";

const LEVELS = Object.keys(defaultLabels.roastLevels);

/**
 * A bag's roast level as a mark: one cell per level the vocabulary has, filled
 * up to this bag's. Empty for a level the vocabulary does not know — an
 * unrecognized token has no place on the scale, and guessing one would draw a
 * fact the document did not state.
 *
 * @param {string | null | undefined} level a roast-level token
 */
export const roastMark = (level) => {
  const n = LEVELS.indexOf(level ?? "");
  if (n < 0) return "";
  const label = vocabularyLabel(defaultLabels.roastLevels, level);
  return `<span class="roast" role="img" aria-label="${esc(`Roast: ${label}, ${n + 1} of ${LEVELS.length}`)}">${LEVELS.map(
    (_, i) => `<i${i <= n ? ' class="on"' : ""} style="--k:${i}"></i>`,
  ).join("")}</span>`;
};
