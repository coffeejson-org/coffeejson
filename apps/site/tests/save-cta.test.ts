// @vitest-environment jsdom

import type { CoffeeJSONDocument } from "@coffeejson/core";
import { expect, test, vi } from "vitest";
import { saveCta, wireSaveCta } from "../src/lib/save";

// The save panel's QR button encodes the whole document into a self-contained
// `?d=` URL. 24 corpus documents are past QR's absolute ceiling, so the button
// has to have an answer for "this cannot be a QR" that is not silence.

const doc = (notes: string): CoffeeJSONDocument =>
  ({
    coffeejson: "1.0",
    recipes: [
      {
        title: "Bench brew",
        coffee: { value: 20, unit: "gram" },
        water: { value: 300, unit: "gram" },
        notes,
      },
    ],
  }) as CoffeeJSONDocument;

/** Mount the panel the way SaveCta does, and click one of its buttons. */
const clickSave = (d: CoffeeJSONDocument, action: string): HTMLElement => {
  const root = document.createElement("div");
  root.innerHTML = saveCta(d, { prominent: false });
  wireSaveCta(root, d);
  root.querySelector<HTMLButtonElement>(`[data-save="${action}"]`)!.click();
  return root;
};

test("the QR button renders a code for a document that fits", async () => {
  const root = clickSave(doc("short"), "qr");
  await vi.waitFor(() =>
    expect(root.querySelector("[data-qr-slot]")!.innerHTML).toContain("<svg"),
  );
});

test("the QR button explains itself when the document is too large to encode", async () => {
  // ~4 KB of base64url once enveloped — past level L at version 40, so no QR
  // exists at any error-correction level. An un-caught rejection here would
  // leave the panel empty: a button that did nothing, with no way for the
  // reader to know why.
  const root = clickSave(doc("x".repeat(3000)), "qr");
  const slot = root.querySelector("[data-qr-slot]")!;
  await vi.waitFor(() => expect(slot.textContent).toMatch(/too (large|big)/i));
  expect(slot.innerHTML).not.toContain("<svg");
  // The reader is left somewhere to go — the link still works, only the QR
  // cannot be drawn.
  expect(slot.textContent).toMatch(/copy link/i);
});
