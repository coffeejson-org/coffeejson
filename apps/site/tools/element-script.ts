import { fileURLToPath } from "node:url";
import core from "../../../packages/core/package.json";
import { elementScriptUrl } from "../src/lib/element-url.mjs";

// `/embed/` loads the element the way a host does: one module script from the
// npm CDN. The page checks the CDN only while that is true, so the site's own
// bundle never imports the element, and this tag is the only place it loads.
// Under `vite serve` the tag points at the workspace build instead, because
// the version the tree names may not be on npm yet.

/** The comment a shell carries where the tag goes. */
export const ELEMENT_SLOT = "<!-- coffee-json element -->";
/** The shells that load the element. */
export const ELEMENT_PAGES = ["embed/index.html"];

const LOCAL_AUTO = fileURLToPath(
  new URL("../../../packages/core/dist/element/auto.js", import.meta.url),
);

export const elementTag = (src: string): string =>
  `<script type="module" src="${src}"></script>`;

/** The shell with its slot filled: the CDN URL, or the local build when serving. */
export function fillElement(
  html: string,
  page: string,
  serve: boolean,
): string {
  if (!ELEMENT_PAGES.includes(page)) return html;
  if (!html.includes(ELEMENT_SLOT))
    throw new Error(`${page} has no ${ELEMENT_SLOT} to fill`);
  const src = serve ? `/@fs${LOCAL_AUTO}` : elementScriptUrl(core.version);
  return html.replace(ELEMENT_SLOT, elementTag(src));
}

/** Vite plugin. "post", so Vite leaves the CDN URL alone in a build. */
export const elementScript = () => {
  let serve = false;
  return {
    name: "coffeejson:element-script",
    configResolved(config: { command: string }) {
      serve = config.command === "serve";
    },
    transformIndexHtml: {
      order: "post" as const,
      handler: (html: string, ctx: { path: string }) =>
        fillElement(html, ctx.path.replace(/^\//, ""), serve),
    },
  };
};
