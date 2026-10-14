// Where a page loads the `<coffee-json>` element from: the npm CDN, at an exact
// version. A `.mjs` because the page, its snippet, the Vite plugin and the
// deploy check all build this URL, and the check is plain Node. The version
// itself is never written here: every caller reads core's own `package.json`.
export const elementScriptUrl = (version) =>
  `https://cdn.jsdelivr.net/npm/@coffeejson/core@${version}/dist/element/auto.js`;
