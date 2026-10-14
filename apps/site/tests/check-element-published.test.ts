import { expect, test } from "vitest";
import { checkElementPublished } from "../tools/check-element-published.mjs";

// The registry and the CDN are stubbed: the suite stays offline, and the real
// check runs only in the deploy workflow.
const stub = (statuses: Record<string, number>) => {
  const asked: string[] = [];
  const fetchImpl = async (url: string) => {
    asked.push(url);
    const host = new URL(url).host;
    const status = statuses[host] ?? 500;
    return { ok: status === 200, status };
  };
  return { asked, fetchImpl };
};

test("passes when npm and the CDN both serve the exact version", async () => {
  const { asked, fetchImpl } = stub({
    "registry.npmjs.org": 200,
    "cdn.jsdelivr.net": 200,
  });
  expect(await checkElementPublished("1.2.0", fetchImpl)).toEqual({ ok: true });
  expect(asked).toEqual([
    "https://registry.npmjs.org/@coffeejson/core/1.2.0",
    "https://cdn.jsdelivr.net/npm/@coffeejson/core@1.2.0/dist/element/auto.js",
  ]);
});

test("stops before asking the CDN when npm does not have the version", async () => {
  const { asked, fetchImpl } = stub({
    "registry.npmjs.org": 404,
    "cdn.jsdelivr.net": 200,
  });
  const result = await checkElementPublished("1.2.0", fetchImpl);
  expect(result).toMatchObject({ ok: false });
  expect(result.ok || result.reason).toMatch(
    /^npm does not serve @coffeejson\/core@1\.2\.0 \(HTTP 404\)\. Publish it first/,
  );
  expect(asked).toHaveLength(1);
});

test("fails while the CDN has not picked the version up", async () => {
  const { fetchImpl } = stub({
    "registry.npmjs.org": 200,
    "cdn.jsdelivr.net": 404,
  });
  const result = await checkElementPublished("1.2.0", fetchImpl);
  expect(result.ok || result.reason).toMatch(
    /^The CDN does not serve https:\/\/cdn\.jsdelivr\.net\/.+ yet \(HTTP 404\)/,
  );
});
