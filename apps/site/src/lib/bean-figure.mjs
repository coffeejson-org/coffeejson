// A `.mjs` with a `.d.mts` beside it, matching `footer.mjs`: the page modules
// are TypeScript built by vite, and `tools/gen.mjs` is plain Node.

import { esc } from "./text.mjs";

/**
 * A blend's origin as a strip: one segment per component, as wide as its share
 * of the bag. Drawn only when the roaster states every share — equal segments
 * for unstated shares would read as a measured split, and a single origin is
 * one full bar that says nothing. Empty otherwise; the bag's origin is still
 * listed in words beside it.
 *
 * @param {{ label: string, share: number | null, altitude: string }[]} components
 */
export function originStrip(components) {
  if (
    components.length < 2 ||
    !components.every((c) => typeof c.share === "number")
  )
    return "";
  const segments = components
    .map(
      (c, i) =>
        `<li style="--share:${c.share};--k:${i}"><span class="strip-bar"></span><strong>${esc(c.label)}</strong><span class="num">${c.share}%</span>${
          c.altitude ? `<span class="num muted">${esc(c.altitude)}</span>` : ""
        }</li>`,
    )
    .join("");
  return `<figure class="strip">
    <ol>${segments}</ol>
    <figcaption class="muted">${components.length} components, drawn to the shares the roaster states.</figcaption>
  </figure>`;
}
