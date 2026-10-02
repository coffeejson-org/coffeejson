import type { CoffeeJSONDocument } from "@coffeejson/core";
import { describe, expect, test } from "vitest";
import { labelDocument } from "../src/lib/label-document";
import { validateDocument } from "../src/lib/validate";

const bag = (): CoffeeJSONDocument => ({
  coffeejson: "1.1",
  beans: [
    {
      name: "Nano Challa",
      roaster: { name: "Example Roastery" },
      process: ["washed"],
      roast_date: "2026-06-20",
      rest_days: { min: 7 },
      description: "A washed Ethiopian from the Nano Challa cooperative.",
      roaster_notes: ["blueberry", "floral"],
    },
  ],
  recipes: [
    {
      title: "Roaster's V60",
      recommended: true,
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
    },
  ],
});

describe("labelDocument — what a printed code carries", () => {
  test("the prose a label already prints is left out, and named", () => {
    const out = labelDocument(bag(), { roastDate: "2026-10-01" })!;
    const bean = out.doc.beans![0]!;
    expect(bean.description).toBeUndefined();
    expect(bean.roaster_notes).toBeUndefined();
    expect(out.leftOut).toEqual(["description", "roaster_notes"]);
  });

  test("the sheet's date replaces the bean's own", () => {
    const out = labelDocument(bag(), { roastDate: "2026-10-01" })!;
    expect(out.doc.beans![0]!.roast_date).toBe("2026-10-01");
    expect(out.leftOut).not.toContain("roast_date");
  });

  test("a sheet reused across batches states no date, and says it dropped one", () => {
    const out = labelDocument(bag(), { roastDate: null })!;
    expect("roast_date" in out.doc.beans![0]!).toBe(false);
    expect(out.leftOut).toContain("roast_date");
    // rest_days is the coffee's own claim and stays either way.
    expect(out.doc.beans![0]!.rest_days).toEqual({ min: 7 });
  });

  test("every recipe is kept, and the result is a valid document", () => {
    const out = labelDocument(bag(), { roastDate: "2026-10-01" })!;
    expect(out.doc.recipes).toEqual(bag().recipes);
    expect(validateDocument(out.doc)).toEqual([]);
  });

  test("a bean-only document stays bean-only", () => {
    const { recipes: _, ...beanOnly } = bag();
    const out = labelDocument(beanOnly, { roastDate: "2026-10-01" })!;
    expect("recipes" in out.doc).toBe(false);
    expect(validateDocument(out.doc)).toEqual([]);
  });

  test("the first bean is the label's; the others are named as left out", () => {
    const two = bag();
    two.beans!.push({
      name: "Las Brisas",
      roaster: { name: "Example Roastery" },
    });
    const out = labelDocument(two, { roastDate: null })!;
    expect(out.doc.beans).toHaveLength(1);
    expect(out.doc.beans![0]!.name).toBe("Nano Challa");
    expect(out.leftOut).toContain("1 more bean");
  });

  test("no bean, no label", () => {
    const { beans: _, ...recipeOnly } = bag();
    expect(labelDocument(recipeOnly, { roastDate: "2026-10-01" })).toBeNull();
  });

  test("the page's document is never changed", () => {
    const doc = bag();
    const before = JSON.stringify(doc);
    labelDocument(doc, { roastDate: null });
    expect(JSON.stringify(doc)).toBe(before);
  });
});
