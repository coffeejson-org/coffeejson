import { beansBody } from "../lib/beans-body";

// The bags hub is prerendered unfiltered by `tools/prerender.ts`, so this module
// exists for one case: `?roaster=<slug>`, which is view state and cannot be baked
// into a single page. Everything else is already on the page when this runs.
const filter = new URLSearchParams(location.search).get("roaster");
if (filter) document.querySelector<HTMLElement>("#app")!.innerHTML = beansBody(filter);
