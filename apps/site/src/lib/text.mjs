// A `.mjs` with a `.d.mts` beside it, matching `footer.mjs`, because two runtimes
// read it: the page modules are TypeScript built by vite, and `tools/gen.mjs` is
// plain Node. A `.ts` module reaches only half the surfaces, and each rule below
// is then hand-copied into the other half.

// React escapes its own children; this is only for the vanilla `innerHTML` glue
// that survives the packages — error banners, filter chips, the save CTA, the
// static pages. All five entities, because these strings land in attributes too.
export const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Unicode letters and digits survive: an ASCII-only class would collapse every
// roaster written in a non-Latin script to the same empty slug, so the bean
// view's roaster chips and the recipe view's author chips share one slug space.
export const slugify = (s) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");

// "1 recipe" / "3 recipes" — count + noun, naive English s-plural (every noun
// this site counts pluralizes that way).
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
