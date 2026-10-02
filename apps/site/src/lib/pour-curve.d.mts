/** `[at_s, to_water, step index]`, in step order. */
export type CurvePoint = [number, number, number];

export interface PourSeries {
  points: CurvePoint[];
  /** Where the time axis ends: the stated finish, or one interval past the last pour. */
  end: number;
  unit: string;
}

interface CurveRecipe {
  steps: {
    atS: number | null;
    toWater: {
      value?: number;
      min?: number;
      max?: number;
      unit: string;
    } | null;
  }[];
  finishS: number | null;
}

export function pourSeries(recipe: CurveRecipe): PourSeries | null;
export interface CurveDomain {
  end: number;
  max: number;
}
export function sharedDomain(all: (PourSeries | null)[]): CurveDomain;
export function corpusScale(
  entries: { curve: PourSeries | null; brewAmount?: number | null }[],
): { domain: CurveDomain; largest: number };
export function weightsSvg(
  dose: number,
  brew: number,
  largest: number,
  label: string,
): string;
export function curvePaths(
  series: PourSeries,
  domain?: CurveDomain,
): {
  line: string;
  area: string;
  x: (t: number) => number;
  y: (w: number) => number;
  max: number;
};
export function sparklineSvg(series: PourSeries, domain?: CurveDomain): string;
export function ratioBarSvg(ratio: number): string;
export function ratioFigure(
  ratio: number,
  coffee: string,
  brew: string,
): string;
export function recipeGlyph(
  entry: {
    curve: PourSeries | null;
    ratioValue: number | null;
    dose?: number | null;
    brewAmount?: number | null;
    coffee?: string;
    brew?: string;
  },
  scale?: { domain?: CurveDomain; largest?: number },
): string;
export function curveFigure(
  series: PourSeries,
  opts?: { caption?: string },
): string;
export function waterAt(series: PourSeries, t: number): number;
export function curveAt(
  series: PourSeries,
  t: number,
): { p: number; h: number; current: number };

export interface CurveParts {
  line: string;
  area: string;
  points: {
    step: number;
    t: number;
    w: number;
    x: number;
    /** Percent up from the baseline. */
    up: number;
    side: "left" | "right" | null;
    /** The label fits only a plot wider than a phone's. */
    wideOnly: boolean;
    label: string;
  }[];
  ticks: { x: number; label: string }[];
}
export function curveParts(
  series: PourSeries,
  opts?: { keepTick?: number },
): CurveParts;
export function overlayFigure(
  entries: { id: string; title: string; curve: PourSeries | null }[],
  domain: CurveDomain,
): string;
export function axisHtml(ticks: CurveParts["ticks"]): string;
