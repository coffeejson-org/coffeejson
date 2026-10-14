// The deploy's gate for `/embed/`. The page loads the element from the npm CDN
// at core's version in this tree, and that version can be one npm does not
// serve yet: the release commit lands before the publish. Deployed then, every
// card would show only its fallback. So the deploy stops here until both the
// registry and the CDN serve that exact version. Run only by the deploy
// workflow; the tests and a local build never touch the network.
import { fileURLToPath } from "node:url";
import core from "../../../packages/core/package.json" with { type: "json" };
import { elementScriptUrl } from "../src/lib/element-url.mjs";

/** `{ ok: true }`, or the reason the deploy must wait. */
export async function checkElementPublished(version, fetchImpl = fetch) {
  const registry = await fetchImpl(
    `https://registry.npmjs.org/@coffeejson/core/${version}`,
  );
  if (!registry.ok)
    return {
      ok: false,
      reason:
        `npm does not serve @coffeejson/core@${version} (HTTP ${registry.status}). ` +
        "Publish it first (RELEASING.md): /embed/ loads that version from the CDN.",
    };
  const url = elementScriptUrl(version);
  const cdn = await fetchImpl(url);
  if (!cdn.ok)
    return {
      ok: false,
      reason: `The CDN does not serve ${url} yet (HTTP ${cdn.status}). Re-run the deploy in a few minutes.`,
    };
  return { ok: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = await checkElementPublished(core.version);
  if (!result.ok) {
    console.error(result.reason);
    process.exit(1);
  }
  console.log(`@coffeejson/core@${core.version} is on npm and the CDN.`);
}
