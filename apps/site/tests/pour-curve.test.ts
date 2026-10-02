import { decodePayload, normalize } from "@coffeejson/core";
import { describe, expect, it } from "vitest";
import {
  corpusScale,
  curveFigure,
  curvePaths,
  pourSeries,
  ratioBarSvg,
  recipeGlyph,
  sharedDomain,
  sparklineSvg,
  waterAt,
  weightsSvg,
} from "../src/lib/pour-curve.mjs";
import { buildIndex } from "../tools/gen.mjs";

const step = (atS: number | null, value: number | null, unit = "gram") => ({
  atS,
  toWater: value === null ? null : { value, unit },
});

const fourSix = {
  steps: [
    step(0, 60),
    step(45, 120),
    step(90, 180),
    step(130, 240),
    step(160, 300),
  ],
  finishS: 210,
};

describe("pourSeries", () => {
  it("reads the timed cumulative water, keeping each point's step index", () => {
    expect(pourSeries(fourSix)).toEqual({
      points: [
        [0, 60, 0],
        [45, 120, 1],
        [90, 180, 2],
        [130, 240, 3],
        [160, 300, 4],
      ],
      end: 210,
      unit: "gram",
    });
  });

  it("skips steps that move no water or name no time, without renumbering", () => {
    const s = pourSeries({
      steps: [step(null, null), step(0, 50), step(30, null), step(60, 250)],
      finishS: 180,
    });
    expect(s?.points).toEqual([
      [0, 50, 1],
      [60, 250, 3],
    ]);
  });

  it("is null when there is nothing to plot", () => {
    expect(pourSeries({ steps: [], finishS: 30 })).toBeNull();
    expect(pourSeries({ steps: [step(0, 250)], finishS: 240 })).toBeNull();
    expect(
      pourSeries({ steps: [step(null, 60), step(null, 300)], finishS: 200 }),
    ).toBeNull();
  });

  it("is null for a schedule it cannot draw honestly", () => {
    // Two units on one axis, and time running backwards.
    expect(
      pourSeries({
        steps: [step(0, 60), step(45, 120, "milliliter")],
        finishS: null,
      }),
    ).toBeNull();
    expect(
      pourSeries({ steps: [step(45, 60), step(0, 120)], finishS: null }),
    ).toBeNull();
  });

  it("skips a window rather than averaging it", () => {
    const s = pourSeries({
      steps: [
        step(0, 50),
        { atS: 30, toWater: { min: 100, max: 120, unit: "gram" } },
        step(60, 250),
      ],
      finishS: null,
    });
    expect(s?.points.map(([t]) => t)).toEqual([0, 60]);
  });

  it("draws the last plateau one average interval long when no finish is stated", () => {
    expect(
      pourSeries({
        steps: [step(0, 50), step(40, 150), step(80, 250)],
        finishS: null,
      })?.end,
    ).toBe(120);
    // A finish before the last pour is not a finish.
    expect(
      pourSeries({ steps: [step(0, 50), step(40, 150)], finishS: 30 })?.end,
    ).toBe(80);
  });
});

describe("curvePaths", () => {
  const s = pourSeries(fourSix)!;

  it("is a staircase from the origin to the end of the axis", () => {
    const { line, area } = curvePaths(s);
    expect(line.startsWith("M0 100H0V80")).toBe(true);
    expect(line.endsWith("V0H100")).toBe(true);
    expect(area).toBe(`${line}V100Z`);
  });

  it("puts the largest target at the top and the finish at the right edge", () => {
    const { x, y } = curvePaths(s);
    expect(y(300)).toBe(0);
    expect(y(0)).toBe(100);
    expect(x(210)).toBe(100);
    expect(x(45)).toBeCloseTo(21.43, 2);
  });
});

describe("waterAt", () => {
  const s = pourSeries(fourSix)!;
  it("reads the plateau the clock is on", () => {
    expect(waterAt(s, 0)).toBe(60);
    expect(waterAt(s, 44.9)).toBe(60);
    expect(waterAt(s, 45)).toBe(120);
    expect(waterAt(s, 500)).toBe(300);
  });
});

describe("the markup", () => {
  const s = pourSeries(fourSix)!;

  it("names the sparkline for a reader who cannot see it", () => {
    expect(sparklineSvg(s)).toContain(
      'aria-label="Pour schedule: 5 pours to 300 g over 3:30"',
    );
  });

  it("draws the ratio bar to scale", () => {
    // 1 : 15 — the coffee is one sixteenth of the bar.
    expect(ratioBarSvg(15)).toContain(
      'class="ratio-coffee" d="M0 100V35H6.25V',
    );
    expect(ratioBarSvg(15)).toContain('aria-label="Coffee to water, 1 : 15"');
  });

  it("gives a row its curve, else its two weights, else its ratio", () => {
    const row = {
      curve: null,
      ratioValue: 15,
      dose: 20,
      brewAmount: 300,
      coffee: "20 g",
      brew: "300 g",
    };
    expect(recipeGlyph({ ...row, curve: s })).toContain("curve-line");
    expect(recipeGlyph(row, { largest: 1200 })).toContain("spark--weights");
    // A window for a dose names no one weight: on a shared scale, nothing.
    expect(recipeGlyph({ ...row, dose: null }, { largest: 1200 })).toBe("");
    // With no scale to hold to, the ratio is still a true proportion.
    expect(recipeGlyph({ ...row, dose: null })).toContain("spark--ratio");
    expect(recipeGlyph({ curve: null, ratioValue: null })).toBe("");
  });

  it("draws weights as cubes against the largest brew", () => {
    // An eighth of the largest brew is a block half as wide.
    const html = weightsSvg(25, 150, 1200, "25 g coffee, 150 g");
    expect(html).toContain('width="50" height="50"');
    expect(html).toContain('aria-label="25 g coffee, 150 g"');
  });

  it("draws a curve on shared axes shorter and lower than its own box", () => {
    const own = curvePaths(s);
    const shared = curvePaths(s, { end: 420, max: 600 });
    expect(own.line.endsWith("H100")).toBe(true);
    expect(shared.line.endsWith("H50")).toBe(true);
    expect(shared.y(300)).toBe(50);
    expect(sharedDomain([s, null, { ...s, end: 400 }])).toEqual({
      end: 400,
      max: 300,
    });
  });

  it("is complete without a script", () => {
    const html = curveFigure(s);
    expect(html).toContain('style="--p:1"');
    expect(html).toContain('data-end="210"');
    expect((html.match(/class="curve-pt[ "]/g) ?? []).length).toBe(5);
    expect(html).toContain("300 g");
    expect(html).toContain('<li style="--x:100%">3:30</li>');
  });

  it("drops a label that would sit on the one before it, never the last", () => {
    const dense = pourSeries({
      steps: [step(0, 50), step(5, 100), step(10, 150), step(100, 300)],
      finishS: 120,
    })!;
    const html = curveFigure(dense);
    expect(html).toContain("50 g");
    expect(html).not.toContain(">100 g<");
    expect(html).toContain("300 g");
    expect(html).toContain("2:00");
  });
});

describe("over the corpus", () => {
  const index = buildIndex();

  it("the index carries exactly the curve the card's own document yields", () => {
    for (const e of index) {
      const r = decodePayload(e.payload);
      if (!r.ok) throw new Error(e.id);
      const n = normalize(r.document).recipes[0]!;
      expect(e.curve, e.id).toEqual(pourSeries(n));
      expect(e.ratioValue, e.id).toBe(n.ratio);
    }
  });

  it("gives a glyph to every row that states a schedule or a single dose", () => {
    const scale = corpusScale(index);
    for (const e of index)
      expect(recipeGlyph(e, scale) !== "", e.id).toBe(
        e.curve !== null || (e.dose !== null && e.brewAmount !== null),
      );
  });

  it("fits every schedule inside the shared box", () => {
    const { domain } = corpusScale(index);
    for (const e of index.filter((x) => x.curve)) {
      expect(e.curve!.end, e.id).toBeLessThanOrEqual(domain.end);
      for (const [, w] of e.curve!.points)
        expect(w, e.id).toBeLessThanOrEqual(domain.max);
    }
  });

  it("has curves to show", () => {
    expect(index.filter((e) => e.curve).length).toBeGreaterThan(20);
  });
});
