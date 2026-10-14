/** `{ ok: true }`, or the reason the deploy must wait for the publish. */
export declare function checkElementPublished(
  version: string,
  fetchImpl?: (url: string) => Promise<{ ok: boolean; status: number }>,
): Promise<{ ok: true } | { ok: false; reason: string }>;
