import { expect, test } from "vitest";
import { safeUrl } from "../src/safe-url";

test("allows https/http/mailto only", () => {
  expect(safeUrl("https://x.com")).toBe("https://x.com");
  expect(safeUrl("http://x.com")).toBe("http://x.com");
  expect(safeUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
  expect(safeUrl("javascript:alert(1)")).toBe("");
  expect(safeUrl("data:text/html,x")).toBe("");
  expect(safeUrl(" https://padded.ok ")).toBe("https://padded.ok");
});

test("tolerates absent and type-confused input (never throws)", () => {
  expect(safeUrl(undefined)).toBe("");
  expect(safeUrl(null)).toBe("");
  expect(safeUrl(123 as unknown as string)).toBe("");
  expect(safeUrl({} as unknown as string)).toBe("");
  expect(
    safeUrl({ toString: () => "https://x.com" } as unknown as string),
  ).toBe("https://x.com");
});
