// @vitest-environment jsdom

import type { CoffeeJSONDocument } from "@coffeejson/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  mountLabelPanel,
  resetLabelDate,
  resetLabelSettings,
  updateLabelPanel,
} from "../src/lib/label-sheet";

const doc = (roast_date?: string): CoffeeJSONDocument => ({
  coffeejson: "1.1",
  beans: [
    {
      name: "Nano Challa",
      roaster: { name: "Example Roastery" },
      ...(roast_date ? { roast_date } : {}),
    },
  ],
});
const mountClosed = (d: CoffeeJSONDocument | null) => {
  const root = document.createElement("div");
  document.body.append(root);
  mountLabelPanel(root, () => d);
  return root;
};
const openPanel = (root: HTMLElement) => {
  const details = root.querySelector("details")!;
  details.open = true;
  details.dispatchEvent(new Event("toggle"));
};
// Opened, because a closed panel builds nothing.
const mount = (d: CoffeeJSONDocument | null) => {
  const root = mountClosed(d);
  openPanel(root);
  return root;
};
const q = <T extends Element>(root: Element, sel: string) =>
  root.querySelector<T>(sel)!;

beforeEach(() => {
  resetLabelSettings();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});
// Here, not at the end of a test, because a failed assertion would otherwise leak a stub.
afterEach(() => vi.unstubAllGlobals());

test("with no bean the panel is hidden", async () => {
  const root = mount(null);
  await updateLabelPanel(root, {
    coffeejson: "1.1",
    recipes: [{ title: "x", coffee: { value: 15, unit: "gram" } }],
  });
  expect(root.hidden).toBe(true);
});

test("a bean shows a sheet, and the print button comes alive", async () => {
  const root = mount(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  expect(root.hidden).toBe(false);
  expect(q(root, "[data-label-preview] svg")).not.toBeNull();
  expect(q<HTMLButtonElement>(root, "[data-label-print]").disabled).toBe(false);
});

test("a closed panel builds no sheet, and opening it builds one", async () => {
  const root = mountClosed(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  expect(root.hidden).toBe(false);
  expect(q(root, "[data-label-preview]").innerHTML).toBe("");
  openPanel(root);
  await vi.waitFor(() =>
    expect(q(root, "[data-label-preview] svg")).not.toBeNull(),
  );
});

test("the sheet's date starts as the bean's own", async () => {
  const root = mount(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  expect(q<HTMLInputElement>(root, '[data-lk="roastDate"]').value).toBe(
    "2026-06-20",
  );
  expect(q(root, "[data-label-preview]").innerHTML).toContain(
    "Roasted 2026-06-20",
  );
});

const pick = (root: HTMLElement, date: string) => {
  const input = q<HTMLInputElement>(root, '[data-lk="roastDate"]');
  input.value = date;
  input.dispatchEvent(new Event("change"));
};
const shown = (root: HTMLElement) => q(root, "[data-label-preview]").innerHTML;

test("a date the reader picked survives other edits to the same batch", async () => {
  const root = mount(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  pick(root, "2026-10-01");
  const renamed = doc("2026-06-20");
  renamed.beans![0]!.name = "Nano Challa, lot 2";
  await updateLabelPanel(root, renamed);
  expect(shown(root)).toContain("Roasted 2026-10-01");
});

test("a picked date does not outlive its batch: the bean's own date changing drops it", async () => {
  const root = mount(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  pick(root, "2026-10-01");
  await updateLabelPanel(root, doc("2026-07-07"));
  expect(shown(root)).toContain("Roasted 2026-07-07");
  expect(q<HTMLInputElement>(root, '[data-lk="roastDate"]').value).toBe(
    "2026-07-07",
  );
});

test("a new document forgets the pick even when its date is the same", async () => {
  const root = mount(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  pick(root, "2026-10-01");
  resetLabelDate();
  await updateLabelPanel(root, doc("2026-06-20"));
  expect(shown(root)).toContain("Roasted 2026-06-20");
});

test("a size out of range is clamped, and the box and the status both say so", async () => {
  const d = doc("2026-06-20");
  const root = mount(d);
  await updateLabelPanel(root, d);
  const box = q<HTMLInputElement>(root, '[data-lk="labelMm"]');
  box.value = "20";
  box.dispatchEvent(new Event("input"));
  box.dispatchEvent(new Event("change"));
  await updateLabelPanel(root, d);
  expect(box.value).toBe("25");
  expect(q(root, "[data-label-status]").textContent).toContain("of 25 mm");
});

test("a build that throws shows an error and leaves nothing to print", async () => {
  const d = doc("2026-06-20");
  const root = mount(d);
  await updateLabelPanel(root, d);
  vi.stubGlobal(
    "CompressionStream",
    class {
      constructor() {
        throw new Error("no");
      }
    },
  );
  await updateLabelPanel(root, d);
  expect(q(root, "[data-label-status]").textContent).toContain(
    "could not be built",
  );
  expect(shown(root)).toBe("");
  expect(q<HTMLButtonElement>(root, "[data-label-print]").disabled).toBe(true);
});

test("a document that stops having a bean is not painted over by a build still in flight", async () => {
  const root = mount(doc("2026-06-20"));
  const slow = updateLabelPanel(root, doc("2026-06-20"));
  await updateLabelPanel(root, null);
  await slow;
  expect(root.hidden).toBe(true);
  expect(shown(root)).toBe("");
});

test("a sheet left behind by a browser that never said it finished printing is replaced, not joined", async () => {
  const d = doc("2026-06-20");
  const root = mount(d);
  await updateLabelPanel(root, d);
  vi.stubGlobal("print", vi.fn());
  const button = q<HTMLButtonElement>(root, "[data-label-print]");
  button.click();
  button.click();
  expect(document.querySelectorAll("#label-print")).toHaveLength(1);
  expect(document.querySelectorAll("#label-print-page")).toHaveLength(1);
  // The preview and the print copy each resolve their own symbol.
  expect(document.querySelectorAll('symbol[id="label-qr"]')).toHaveLength(1);
  expect(document.querySelectorAll('symbol[id="label-qr-print"]')).toHaveLength(
    1,
  );
  window.dispatchEvent(new Event("afterprint"));
});

test("printing puts the sheet at body level at its paper size, and takes it away after", async () => {
  const root = mount(doc("2026-06-20"));
  await updateLabelPanel(root, doc("2026-06-20"));
  const print = vi.fn();
  vi.stubGlobal("print", print);
  q<HTMLButtonElement>(root, "[data-label-print]").click();
  const host = document.querySelector("#label-print > svg")!;
  expect(print).toHaveBeenCalledOnce();
  expect(host.getAttribute("width")).toBe("210mm");
  expect(document.documentElement.classList.contains("printing-labels")).toBe(
    true,
  );
  expect(document.head.innerHTML).toContain("@page { size: A4; margin: 0; }");
  window.dispatchEvent(new Event("afterprint"));
  expect(document.querySelector("#label-print")).toBeNull();
  expect(document.documentElement.classList.contains("printing-labels")).toBe(
    false,
  );
});
