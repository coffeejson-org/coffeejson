import type { CoffeeJSONDocument } from "@coffeejson/core";
import { decodePayload, encodePayload } from "@coffeejson/core";
import { afterEach, expect, test, vi } from "vitest";
import { compressPayload } from "../src/lib/compress-payload";

const doc: CoffeeJSONDocument = {
  coffeejson: "1.1",
  beans: [
    {
      name: "Nano Challa",
      roaster: { name: "Example Roastery" },
      origin: { type: "single", items: [{ country: "ET", region: "Guji" }] },
      process: ["washed"],
      roast_date: "2026-06-20",
    },
  ],
  recipes: [
    {
      title: "Roaster's V60",
      method: "pour_over",
      recommended: true,
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
      water_temp: { value: 94, unit: "celsius" },
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

test("a compressed payload is shorter and decodes to the same document", async () => {
  const { payload, compressed } = await compressPayload(doc);
  expect(compressed).toBe(true);
  expect(payload.length).toBeLessThan(encodePayload(doc).length);
  expect(decodePayload(payload)).toEqual({ ok: true, document: doc });
});

test("a document too small to gain keeps the plain form", async () => {
  const tiny = { coffeejson: "1.1", beans: [{ name: "A" }] };
  const { payload, compressed } = await compressPayload(tiny);
  expect(compressed).toBe(false);
  expect(payload).toBe(encodePayload(tiny));
});

test("without CompressionStream the plain form is used", async () => {
  vi.stubGlobal("CompressionStream", undefined);
  const { payload, compressed } = await compressPayload(doc);
  expect(compressed).toBe(false);
  expect(payload).toBe(encodePayload(doc));
});
