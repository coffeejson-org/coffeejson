/** Paper sizes in millimeters, portrait. */
export const PAPERS = {
  a4: { name: "A4", cssSize: "A4", w: 210, h: 297 },
  letter: { name: "US Letter", cssSize: "letter", w: 215.9, h: 279.4 },
} as const;
export type PaperId = keyof typeof PAPERS;

export interface SheetSpec {
  paper: PaperId;
  /** The side of the square a code is drawn in. */
  labelMm: number;
  /** The strip under the code for its line of text; 0 for none. */
  textMm: number;
  /** Space between neighboring labels. */
  gapMm: number;
  /** The least space kept clear at every edge of the page. */
  marginMm: number;
}

export interface SheetLayout {
  cols: number;
  rows: number;
  /** One label's box. */
  cellW: number;
  cellH: number;
  /** Where the grid starts, so it sits centered on the page. */
  originX: number;
  originY: number;
  /** The top-left corner of each label, row by row. */
  cells: { x: number; y: number }[];
}

// How many boxes of `size` fit in `room` with `gap` between neighbors. The
// epsilon keeps 190 / 38 from landing on 4.999… and losing a column.
const fit = (room: number, size: number, gap: number): number =>
  Math.max(0, Math.floor((room + gap) / (size + gap) + 1e-9));

/**
 * A grid of identical labels on one page, in millimeters. `cols` or `rows` of 0
 * means one label does not fit inside the margins, and `cells` is then empty.
 */
export function sheetLayout(spec: SheetSpec): SheetLayout {
  const { w, h } = PAPERS[spec.paper];
  const cellW = spec.labelMm;
  const cellH = spec.labelMm + spec.textMm;
  const cols = fit(w - 2 * spec.marginMm, cellW, spec.gapMm);
  const rows = fit(h - 2 * spec.marginMm, cellH, spec.gapMm);
  const gridW = cols * cellW + Math.max(0, cols - 1) * spec.gapMm;
  const gridH = rows * cellH + Math.max(0, rows - 1) * spec.gapMm;
  const originX = (w - gridW) / 2;
  const originY = (h - gridH) / 2;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push({
        x: originX + c * (cellW + spec.gapMm),
        y: originY + r * (cellH + spec.gapMm),
      });
  return { cols, rows, cellW, cellH, originX, originY, cells };
}

/**
 * The printed width of one QR module. `modules` is the symbol's side and
 * `quiet` the blank margin on each side, both in modules.
 */
export const moduleMm = (
  labelMm: number,
  modules: number,
  quiet: number,
): number => labelMm / (modules + 2 * quiet);
