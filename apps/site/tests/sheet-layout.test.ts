import { describe, expect, test } from "vitest";
import type { PaperId } from "../src/lib/sheet-layout";
import { moduleMm, PAPERS, sheetLayout } from "../src/lib/sheet-layout";

const spec = (paper: PaperId, labelMm: number, textMm = 5) => ({
  paper,
  labelMm,
  textMm,
  gapMm: 3,
  marginMm: 10,
});

describe("sheetLayout — a grid of labels on one page", () => {
  test("A4 at 40 mm with a text strip is 4 across and 5 down", () => {
    const l = sheetLayout(spec("a4", 40));
    expect([l.cols, l.rows, l.cells.length]).toEqual([4, 5, 20]);
  });

  test("an exact fit is not lost to rounding", () => {
    // 5 × 38 = 190 = 210 − 2 × 10, with no gap.
    const l = sheetLayout({ ...spec("a4", 38, 0), gapMm: 0 });
    expect(l.cols).toBe(5);
  });

  test.each([
    ["a4", 25],
    ["a4", 40],
    ["a4", 80],
    ["letter", 25],
    ["letter", 40],
    ["letter", 80],
  ] as const)("on %s at %i mm no label crosses a margin", (paper, labelMm) => {
    const s = spec(paper, labelMm);
    const l = sheetLayout(s);
    const { w, h } = PAPERS[paper];
    expect(l.cells.length).toBeGreaterThan(0);
    for (const c of l.cells) {
      expect(c.x).toBeGreaterThanOrEqual(s.marginMm - 1e-9);
      expect(c.y).toBeGreaterThanOrEqual(s.marginMm - 1e-9);
      expect(c.x + l.cellW).toBeLessThanOrEqual(w - s.marginMm + 1e-9);
      expect(c.y + l.cellH).toBeLessThanOrEqual(h - s.marginMm + 1e-9);
    }
  });

  test("the grid is centered on the page", () => {
    const l = sheetLayout(spec("a4", 40));
    const last = l.cells[l.cells.length - 1]!;
    expect(l.cells[0]!.x).toBeCloseTo(PAPERS.a4.w - (last.x + l.cellW));
    expect(l.cells[0]!.y).toBeCloseTo(PAPERS.a4.h - (last.y + l.cellH));
  });

  test("neighbors are a gap apart and never overlap", () => {
    const l = sheetLayout(spec("a4", 40));
    expect(l.cells[1]!.x - l.cells[0]!.x).toBeCloseTo(l.cellW + 3);
    expect(l.cells[l.cols]!.y - l.cells[0]!.y).toBeCloseTo(l.cellH + 3);
  });

  test("a label larger than the page inside its margins gives no cells", () => {
    const l = sheetLayout({ ...spec("a4", 80), marginMm: 70 });
    expect(l.cells).toEqual([]);
  });
});

test("moduleMm counts the quiet zone on both sides", () => {
  // 40 mm over a 33-module symbol with a 4-module margin: 41 modules.
  expect(moduleMm(40, 33, 4)).toBeCloseTo(40 / 41);
});
