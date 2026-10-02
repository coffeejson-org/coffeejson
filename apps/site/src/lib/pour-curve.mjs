// A `.mjs` with a `.d.mts` beside it, matching `footer.mjs`: the page modules
// are TypeScript built by vite, and `tools/gen.mjs` is plain Node.

import { fmtClock, fmtMeasurement, formatRatio } from "@coffeejson/core";
import { esc } from "./text.mjs";

const round = (n) => Math.round(n * 100) / 100;

/**
 * The timed, cumulative water a recipe states, or `null` when it states too
 * little to plot. A point is a step carrying both `at_s` and a single-valued
 * `to_water`; a window (`min`/`max`) names no one height, so it is skipped
 * rather than averaged.
 *
 * @param {{ steps: { atS: number | null, toWater: { value?: number, unit: string } | null }[], finishS: number | null }} recipe
 */
export function pourSeries(recipe) {
  const points = [];
  recipe.steps.forEach((s, i) => {
    if (s.atS === null || typeof s.toWater?.value !== "number") return;
    points.push([s.atS, s.toWater.value, i]);
  });
  if (points.length < 2) return null;
  const unit = recipe.steps[points[0][2]].toWater.unit;
  for (let k = 0; k < points.length; k++) {
    if (recipe.steps[points[k][2]].toWater.unit !== unit) return null;
    if (k > 0 && points[k][0] < points[k - 1][0]) return null;
  }
  const first = points[0][0];
  const last = points[points.length - 1][0];
  if (last === first) return null;
  // With no stated finish the last plateau is drawn one average interval long:
  // long enough to read, and no claim about when the brew ends.
  const end =
    recipe.finishS !== null && recipe.finishS > last
      ? recipe.finishS
      : last + (last - first) / (points.length - 1);
  return { points, end, unit };
}

/**
 * The staircase in a 100 × 100 box: x is time, y is water, origin top-left.
 * By default the box is the recipe's own — its last second at the right edge,
 * its total at the top. Given a `domain`, the box is that many seconds wide and
 * that much water tall, so curves drawn to one domain can be compared: a short
 * brew is a short curve.
 *
 * @param {{ points: number[][], end: number }} series
 * @param {{ end: number, max: number }} [domain]
 */
export function curvePaths(series, domain) {
  const max = domain?.max ?? Math.max(...series.points.map(([, w]) => w));
  const span = domain?.end ?? series.end;
  const x = (t) => round((t / span) * 100);
  const y = (w) => round(100 - (w / max) * 100);
  let line = `M0 100`;
  for (const [t, w] of series.points) line += `H${x(t)}V${y(w)}`;
  line += `H${x(series.end)}`;
  return { line, area: `${line}V100Z`, x, y, max };
}

/**
 * The one box every timed recipe in a set fits in: the longest brew wide, the
 * largest total tall.
 *
 * @param {({ points: number[][], end: number } | null)[]} all
 */
export function sharedDomain(all) {
  const timed = all.filter(Boolean);
  return {
    end: Math.max(...timed.map((s) => s.end)),
    max: Math.max(...timed.flatMap((s) => s.points.map(([, w]) => w))),
  };
}

const describe = (series) => {
  const last = series.points[series.points.length - 1];
  const total = fmtMeasurement({ value: last[1], unit: series.unit });
  return `Pour schedule: ${series.points.length} pours to ${total} over ${fmtClock(series.end)}`;
};

/**
 * The row-sized curve. Stretches to its box; the stroke does not scale. With a
 * `domain` it is drawn on shared axes.
 */
export const sparklineSvg = (series, domain) => {
  const { line, area } = curvePaths(series, domain);
  return `<svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(describe(series))}"><path class="curve-area" d="${area}"/><path class="curve-line" d="${line}"/></svg>`;
};

/**
 * What a card shows when the recipe has no timed pours: the dose against the
 * water, to scale, drawn in the curve's own language — a filled area under a
 * stroked top edge. Every card carries a glyph drawn from its own numbers.
 *
 * @param {number} ratio parts water (or yield) to one part coffee
 */
export const ratioBarSvg = (ratio) => {
  const coffee = round(Math.max(100 / (1 + ratio), 1.5));
  return `<svg class="spark spark--ratio" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(`Coffee to water, ${formatRatio(ratio)}`)}"><path class="ratio-coffee" d="M0 100V35H${coffee}V100Z"/><path class="curve-area" d="M${coffee} 100V35H100V100Z"/><path class="curve-line" d="M${coffee} 35H100"/></svg>`;
};

/**
 * The same proportion at full size, for a recipe page with no schedule to
 * draw: the bar, with each side named by its own weight.
 *
 * @param {number} ratio parts water (or yield) to one part coffee
 * @param {string} coffee the dose, formatted
 * @param {string} brew the water or yield, formatted; may be empty
 */
export const ratioFigure = (ratio, coffee, brew) => {
  const share = round(Math.max(100 / (1 + ratio), 1.5));
  return `<figure class="ratio" style="--c:${share}%">
    <div class="ratio-bar" aria-hidden="true"><span></span><span></span></div>
    <p class="ratio-legend"><span>${esc(coffee)} coffee</span><span>${esc(brew ? `${brew} · ` : "")}${esc(formatRatio(ratio))}</span></p>
    <figcaption class="visually-hidden">${esc(`Coffee to water, ${formatRatio(ratio)}`)}</figcaption>
  </figure>`;
};

/**
 * A recipe with no schedule, as its two weights: a block of coffee beside a
 * block of water, each drawn as the face of a cube holding that many grams —
 * so its side grows with the cube root. Drawn against the largest brew in the
 * set: an espresso is two small blocks and a batch of cold brew fills the box.
 * A cube, because the weights span two orders of magnitude; as lengths, or
 * even as areas, most of them were a speck.
 *
 * @param {number} dose grams of coffee
 * @param {number} brew grams of water or yield
 * @param {number} largest the largest `brew` in the set
 * @param {string} label what it says, for a reader who cannot see it
 */
export const weightsSvg = (dose, brew, largest, label) => {
  const side = (grams) => round(Math.cbrt(grams / largest) * 100);
  const c = side(dose);
  const w = side(brew);
  return `<svg class="spark spark--weights" viewBox="0 0 220 100" preserveAspectRatio="xMinYMax meet" role="img" aria-label="${esc(label)}"><rect class="ratio-coffee" x="0" y="${round(100 - c)}" width="${c}" height="${c}"/><rect class="curve-area" x="${round(c + 8)}" y="${round(100 - w)}" width="${w}" height="${w}"/><path class="curve-line" d="M${round(c + 8)} ${round(100 - w)}h${w}"/></svg>`;
};

/**
 * The scale a set of recipes is drawn to: one box for every schedule, and the
 * largest brew among the recipes that state none.
 *
 * @param {{ curve: any, brewAmount?: number | null }[]} entries
 */
export const corpusScale = (entries) => ({
  domain: sharedDomain(entries.map((e) => e.curve)),
  largest: Math.max(
    0,
    ...entries.filter((e) => !e.curve).map((e) => e.brewAmount ?? 0),
  ),
});

/**
 * The glyph a recipe row carries: its curve where it states a schedule, its
 * two weights where it states those, its ratio otherwise.
 *
 * @param {{ curve: any, ratioValue: number | null, dose?: number | null, brewAmount?: number | null, coffee?: string, brew?: string }} entry
 * @param {{ domain?: { end: number, max: number }, largest?: number }} [scale]
 */
export const recipeGlyph = (entry, scale = {}) => {
  if (entry.curve) return sparklineSvg(entry.curve, scale.domain);
  if (scale.largest && entry.dose && entry.brewAmount)
    return weightsSvg(
      entry.dose,
      entry.brewAmount,
      scale.largest,
      `${entry.coffee} coffee, ${entry.brew || formatRatio(entry.ratioValue)}`,
    );
  // With a scale to hold to and no single weight to draw on it, nothing: a
  // ratio bar here would fill the cell and read as the largest brew in the set.
  if (scale.largest) return "";
  return entry.ratioValue ? ratioBarSvg(entry.ratioValue) : "";
};

// Labels are HTML positioned by percentage, not SVG text: the plot stretches to
// any width, and text inside a stretched viewBox would stretch with it.

/**
 * Percent of the plot's width a weight label needs clear beside its point: in
 * a figure as wide as a page column, and in one as narrow as a phone.
 */
const LABEL_ROOM = { wide: 9, narrow: 14 };
/** Percent of the plot's height two labels need between them to stack. */
const LABEL_RISE = 12;

// A label sits to the right of its point, over its own plateau, when the next
// riser is far enough away not to strike through it; failing that, to the left,
// over the plateau before — unless that plateau's own label is there and the
// riser between them is too short to stack them. When every point can be
// labeled, every point is. When any cannot, only the first and the last are: a
// figure that names some of its points and not others reads as a mistake, and
// the step list under it carries every number.
function placeLabels(pts, room) {
  const side = pts.map((p, i) => {
    const next = pts[i + 1]?.x ?? 100;
    const prev = pts[i - 1];
    if (next - p.x >= room) return "right";
    const roomLeft = prev === undefined ? p.x : p.x - prev.x;
    return roomLeft >= room ? "left" : null;
  });
  const clash = side.some(
    (s, i) =>
      s === null ||
      (s === "left" &&
        side[i - 1] === "right" &&
        pts[i].x - pts[i - 1].x < room * 2 &&
        pts[i - 1].y - pts[i].y < LABEL_RISE),
  );
  if (!clash) return side;
  const last = pts.length - 1;
  return pts.map((p, i) =>
    i === 0
      ? "right"
      : i === last
        ? 100 - p.x >= room
          ? "right"
          : "left"
        : null,
  );
}

// An axis tick that would sit on the one before it is dropped. The first and
// the last — the start and the end of the brew — never are.
// `keep` names one tick that stays whatever it crowds — the pour being edited
// — and its neighbors give way to it instead.
const thinTicks = (ticks, minGap, keep = -1) => {
  const last = ticks[ticks.length - 1];
  const must = ticks[keep];
  const near = (a, b) => Math.abs(a.x - b.x) < minGap;
  const kept = [];
  ticks.slice(0, -1).forEach((tick, i) => {
    const prev = kept[kept.length - 1];
    if (i === keep) {
      if (prev && near(tick, prev) && kept.length > 1) kept.pop();
      kept.push(tick);
      return;
    }
    if (must && near(tick, must)) return;
    if (prev && near(tick, prev)) return;
    if (kept.length > 0 && near(last, tick)) return;
    kept.push(tick);
  });
  return [...kept, last];
};

/**
 * Everything a figure is drawn from, as values: the two paths, each point with
 * its place and its label, and the axis ticks. `curveFigure` prints them; an
 * editor that moves a point recomputes them and patches the same elements.
 *
 * @param {NonNullable<ReturnType<typeof pourSeries>>} series
 * @param {{ keepTick?: number }} [opts] `keepTick`: a point whose axis tick stays whatever it crowds
 */
export function curveParts(series, opts = {}) {
  const { line, area, x, y } = curvePaths(series);
  const pts = series.points.map(([t, w, i]) => ({ t, w, i, x: x(t), y: y(w) }));
  const sides = placeLabels(pts, LABEL_ROOM.wide);
  // The same question asked of a phone-width plot. A label that would sit
  // somewhere else there, or nowhere, is marked for wide plots only.
  const narrow = placeLabels(pts, LABEL_ROOM.narrow);
  return {
    line,
    area,
    points: pts.map((p, k) => ({
      step: p.i,
      t: p.t,
      w: p.w,
      x: p.x,
      up: round(100 - p.y),
      side: sides[k],
      wideOnly: sides[k] !== null && narrow[k] !== sides[k],
      label: fmtMeasurement({ value: p.w, unit: series.unit }),
    })),
    ticks: thinTicks(
      [...pts.map((p) => ({ t: p.t, x: p.x })), { t: series.end, x: 100 }],
      14,
      opts.keepTick,
    ).map((k) => ({ x: k.x, label: fmtClock(k.t) })),
  };
}

/** The axis's items, for `curveFigure` and for an editor redrawing it. */
export const axisHtml = (ticks) =>
  ticks.map((k) => `<li style="--x:${k.x}%">${k.label}</li>`).join("");

/**
 * The full figure: plot, a point per pour, a time axis. `--p` (0–1) is how
 * much of the brew has happened and `--h` (0–1) how high the water stands;
 * `--p` starts at 1, so the figure is complete with no script, and a player
 * lowers it.
 *
 * @param {NonNullable<ReturnType<typeof pourSeries>>} series
 * @param {{ caption?: string }} [opts]
 */
export function curveFigure(series, opts = {}) {
  const parts = curveParts(series);
  const svg = (layer) =>
    `<svg class="curve-svg curve-svg--${layer}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="curve-area" d="${parts.area}"/><path class="curve-line" d="${parts.line}"/></svg>`;
  const points = parts.points
    .map(
      (p) =>
        `<span class="curve-pt${p.side === "left" ? " curve-pt--left" : ""}" data-step="${p.step}" data-t="${p.t}" data-w="${p.w}" style="--x:${p.x}%;--y:${p.up}%">${
          p.side
            ? `<span class="curve-pt-w${p.wideOnly ? " curve-pt-w--wide" : ""}">${esc(p.label)}</span>`
            : ""
        }</span>`,
    )
    .join("");
  return `<figure class="curve" style="--p:1" data-end="${series.end}" data-unit="${esc(series.unit)}">
    <div class="curve-plot">${svg("ghost")}${svg("done")}${points}<span class="curve-playhead" aria-hidden="true"></span></div>
    <ol class="curve-axis" aria-hidden="true">${axisHtml(parts.ticks)}</ol>
    <figcaption class="${opts.caption ? "muted" : "visually-hidden"}">${esc(opts.caption ?? describe(series))}</figcaption>
  </figure>`;
}

/** Cumulative water at `t`, as the staircase reads it. */
export const waterAt = (series, t) => {
  let w = 0;
  for (const [at, to] of series.points) if (at <= t) w = to;
  return w;
};

/**
 * Where a figure stands at second `t`: the fraction of the brew done, the
 * fraction of the final water in, and the index of the pour it is on (-1 before
 * the first). What a player sets `--p` and `--h` from.
 */
export const curveAt = (series, t) => {
  const max = Math.max(...series.points.map(([, w]) => w));
  let current = -1;
  series.points.forEach(([at], i) => {
    if (at <= t) current = i;
  });
  return {
    p: Math.min(1, Math.max(0, t / series.end)),
    h: current < 0 ? 0 : series.points[current][1] / max,
    current,
  };
};

/**
 * Every schedule in a set on one pair of axes: a line per recipe, minutes
 * along the bottom, water up the side. Where a row's glyph shows one recipe to
 * scale, this shows them against each other. Each line carries its row's id,
 * so a page can light the two together.
 *
 * @param {{ id: string, title: string, curve: any }[]} entries
 * @param {{ end: number, max: number }} domain
 */
export function overlayFigure(entries, domain) {
  const timed = entries.filter((e) => e.curve);
  if (timed.length < 2) return "";
  const lines = timed
    .map((e) => {
      const d = curvePaths(e.curve, domain).line;
      return `<path class="ov-line" data-id="${esc(e.id)}" d="${d}"/><path class="ov-hit" data-id="${esc(e.id)}" d="${d}"><title>${esc(e.title)}</title></path>`;
    })
    .join("");
  const step = domain.max > 500 ? 200 : 100;
  const levels = [];
  for (let w = step; w <= domain.max; w += step) levels.push(w);
  const grid = levels
    .map(
      (w) =>
        `<path class="ov-grid" d="M0 ${round(100 - (w / domain.max) * 100)}H100"/>`,
    )
    .join("");
  const marks = levels
    .map((w) => `<li style="--y:${round((w / domain.max) * 100)}%">${w} g</li>`)
    .join("");
  const minutes = [];
  for (let t = 0; t <= domain.end; t += 60) minutes.push(t);
  const ticks = minutes
    .map(
      (t) =>
        `<li style="--x:${round((t / domain.end) * 100)}%">${fmtClock(t)}</li>`,
    )
    .join("");
  return `<figure class="overlay">
    <div class="overlay-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${grid}${lines}</svg><ol class="overlay-levels" aria-hidden="true">${marks}</ol></div>
    <ol class="curve-axis overlay-axis" aria-hidden="true">${ticks}</ol>
    <figcaption class="muted" data-overlay-caption>${timed.length} pour schedules on one pair of axes: minutes along, water up.</figcaption>
  </figure>`;
}
