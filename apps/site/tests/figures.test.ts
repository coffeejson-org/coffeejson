import { describe, expect, it } from "vitest";
import { originStrip } from "../src/lib/bean-figure.mjs";
import {
  curveFigure,
  curveParts,
  ratioFigure,
} from "../src/lib/pour-curve.mjs";
import { buildBeansIndex } from "../tools/gen.mjs";

const series = (points: [number, number][], end: number) => ({
  points: points.map(([t, w], i) => [t, w, i] as [number, number, number]),
  end,
  unit: "gram",
});

describe("weight labels", () => {
  const fourSix = series(
    [
      [0, 60],
      [45, 120],
      [90, 180],
      [130, 240],
      [160, 300],
    ],
    210,
  );
  // Six pours, three of them fifteen to twenty-five seconds apart.
  const crowded = series(
    [
      [0, 50],
      [30, 160],
      [45, 220],
      [65, 280],
      [90, 340],
      [120, 400],
    ],
    210,
  );
  // Two pours five seconds and five grams apart: no room beside, none to stack.
  const touching = series(
    [
      [0, 60],
      [100, 200],
      [105, 205],
      [110, 210],
      [160, 300],
    ],
    210,
  );

  it("labels every point when every point has room", () => {
    const parts = curveParts(fourSix);
    expect(parts.points.every((p) => p.side !== null)).toBe(true);
    expect(parts.points.some((p) => p.wideOnly)).toBe(false);
  });

  it("labels a crowded schedule in full on a wide plot, and its ends on a phone", () => {
    const parts = curveParts(crowded);
    expect(parts.points.every((p) => p.side !== null)).toBe(true);
    // What survives at phone width: the first and the last.
    expect(parts.points.map((p) => !p.wideOnly)).toEqual([
      true,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect((curveFigure(crowded).match(/curve-pt-w--wide/g) ?? []).length).toBe(
      4,
    );
  });

  // A figure that names some of its points and not others reads as a mistake.
  it("labels only the first and the last when any point has no room at all", () => {
    const parts = curveParts(touching);
    expect(parts.points.map((p) => p.side !== null)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ]);
  });
});

describe("ratioFigure", () => {
  it("draws the dose to scale and names both sides", () => {
    const html = ratioFigure(2.5, "19 g", "47 g");
    // One part in three and a half.
    expect(html).toContain('style="--c:28.57%"');
    expect(html).toContain("19 g coffee");
    expect(html).toContain("47 g · 1 : 2.5");
  });

  it("names only the ratio when the recipe states no water", () => {
    expect(ratioFigure(16, "15 g", "")).toContain("<span>1 : 16</span>");
  });
});

describe("originStrip", () => {
  it("draws stated shares as stated", () => {
    const html = originStrip([
      { label: "Honduras", share: 60, altitude: "" },
      { label: "Peru", share: 40, altitude: "1500 m" },
    ]);
    expect(html).toContain("--share:60");
    expect(html).toContain("--share:40");
    expect(html).toContain(">60%<");
    expect(html).toContain("drawn to the shares the roaster states");
  });

  // Equal segments would read as a measured half-and-half.
  it("draws nothing when the roaster states no shares", () => {
    expect(
      originStrip([
        { label: "Colombia", share: null, altitude: "1800 m" },
        { label: "Ethiopia", share: null, altitude: "1800 m" },
      ]),
    ).toBe("");
  });

  it("draws nothing when only some shares are stated", () => {
    expect(
      originStrip([
        { label: "A", share: 70, altitude: "" },
        { label: "B", share: null, altitude: "" },
      ]),
    ).toBe("");
  });

  it("draws nothing for a single origin, or none", () => {
    expect(originStrip([{ label: "Kenya", share: 100, altitude: "" }])).toBe(
      "",
    );
    expect(originStrip([])).toBe("");
  });

  it("escapes what a roaster wrote", () => {
    expect(
      originStrip([
        { label: "<b>x</b> & y", share: 50, altitude: "" },
        { label: "z", share: 50, altitude: "" },
      ]),
    ).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
  });

  it("has a component for every origin line the index carries", () => {
    for (const b of buildBeansIndex())
      expect(b.components.length, b.key).toBe(b.origins.length);
  });
});
