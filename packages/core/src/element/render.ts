import {
  fmtClock,
  fmtMeasurement,
  fmtStepTime,
  formatRatio,
  originLine,
  processLine,
  vocabularyLabel,
} from "../format.js";
import type { LabelSet } from "../labels.js";
import type {
  NormalizedBean,
  NormalizedDoc,
  NormalizedRecipe,
  NormalizedStep,
} from "../normalize.js";
import { safeUrl } from "../safe-url.js";
import type { Measurement } from "../types.js";
import type { UnitSystem } from "../units.js";
import { convertMeasurement } from "../units.js";

export interface RenderOptions {
  labels: LabelSet;
  /** The unit system measurements are shown in. */
  units: UnitSystem;
  /** A BCP-47 tag for the digits. A malformed one falls back to `en`. */
  locale: string;
}

type Fmt = (m: Measurement | null | undefined) => string;

function formatter(o: RenderOptions): Fmt {
  let nf: Intl.NumberFormat;
  const opts = { maximumFractionDigits: 1, useGrouping: false };
  try {
    nf = new Intl.NumberFormat(o.locale, opts);
  } catch {
    nf = new Intl.NumberFormat("en", opts);
  }
  return (m) =>
    m
      ? fmtMeasurement(convertMeasurement(m, o.units), (n) => nf.format(n))
      : "";
}

// Every node is built with `createElement` and filled through `textContent`,
// so nothing a document says is ever parsed as markup. `name` is both the class
// and the `part`, every word of it, so the host page can style a part without
// piercing the root and can tell a bean card from a recipe card.
function el(
  d: Document,
  tag: string,
  name: string,
  text?: string,
): HTMLElement {
  const node = d.createElement(tag);
  node.className = name;
  node.setAttribute("part", name);
  if (text !== undefined) node.textContent = text;
  return node;
}

function fact(
  d: Document,
  id: string,
  label: string,
  value: string | Node[],
): HTMLElement | null {
  if (typeof value === "string" ? !value : value.length === 0) return null;
  const row = el(d, "div", "cj-fact");
  row.setAttribute("data-cj-fact", id);
  const v = el(d, "span", "cj-fact-value");
  if (typeof value === "string") v.textContent = value;
  else v.append(...value);
  row.append(el(d, "span", "cj-fact-label", label), " ", v);
  return row;
}

const add = (parent: Node, ...kids: (Node | null)[]): void => {
  for (const k of kids) if (k) parent.appendChild(k);
};

function link(d: Document, href: string | null, text: string): Node {
  if (!href) return d.createTextNode(text);
  const a = d.createElement("a");
  a.href = href;
  a.rel = "noopener";
  a.setAttribute("part", "cj-link");
  a.textContent = text;
  return a;
}

function beanCard(d: Document, b: NormalizedBean, o: RenderOptions, fmt: Fmt) {
  const L = o.labels;
  const card = el(d, "article", "cj-card cj-bean-card");
  const roasterText = b.roaster?.name ?? b.url ?? "";
  const roastLine = [
    vocabularyLabel(L.roastLevels, b.roastLevel),
    b.roastAgtron !== null ? `${L.facts.agtron} ${b.roastAgtron}` : "",
    b.roastDate ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  add(
    card,
    el(d, "h3", "cj-title", b.name || L.beanFallback),
    roasterText
      ? fact(d, "roaster", L.facts.roaster, [
          link(d, safeUrl(b.roaster?.url) || safeUrl(b.url), roasterText),
        ])
      : null,
    fact(
      d,
      "origin",
      L.facts.origin,
      b.originItems.map((it) =>
        el(d, "span", "cj-origin-item", originLine(it, L, fmt)),
      ),
    ),
    fact(
      d,
      "process",
      L.facts.process,
      [processLine(b.process, L), b.dryingMethod ?? ""]
        .filter(Boolean)
        .join(" · "),
    ),
    fact(d, "varietals", L.facts.varietals, b.varietals.join(", ")),
    fact(d, "roast", L.facts.roast, roastLine),
    b.roasterNotes.length
      ? fact(d, "roasterNotes", L.facts.roasterNotes, [
          el(d, "em", "cj-notes", b.roasterNotes.join(", ")),
        ])
      : null,
    b.description ? el(d, "p", "cj-description", b.description) : null,
  );
  return card;
}

// The first targeted step shows its fill unsigned; every later pour carries a "+".
function pourAmount(steps: readonly NormalizedStep[], i: number, fmt: Fmt) {
  const step = steps[i];
  if (!step || step.pourDelta === null) return "";
  const amount = fmt(step.pourDelta);
  if (!amount) return "";
  return i === steps.findIndex((s) => s.toWater !== null)
    ? amount
    : `+${amount}`;
}

function stepItem(
  d: Document,
  r: NormalizedRecipe,
  i: number,
  columnar: boolean,
  o: RenderOptions,
  fmt: Fmt,
) {
  const step = r.steps[i]!;
  const li = el(d, "li", "cj-step");
  li.setAttribute("data-step", String(i));
  // `pour` is what a step means when it states no kind, so only the others are named.
  const kind =
    step.kind && step.kind !== "pour"
      ? `[${vocabularyLabel(o.labels.stepKinds, step.kind)}] `
      : "";
  const body = el(d, "span", "cj-step-body", `${kind}${step.text}`);
  li.append(el(d, "span", "cj-step-time", fmtStepTime(step.atS)), body);
  if (!step.toWater) return li;
  const target = el(d, "strong", "cj-step-target", fmt(step.toWater));
  if (!columnar) {
    body.append(" ", target);
    return li;
  }
  // A recipe with a pour beyond its first lays each row's water out as siblings,
  // so a page can grid them into Pour and Total columns.
  const pour = pourAmount(r.steps, i, fmt);
  const delta = pour
    ? el(d, "span", "cj-step-delta", pour)
    : el(d, "span", "cj-step-delta cj-step-delta--none", "—");
  li.append(" ", delta, " ", target);
  return li;
}

function recipeCard(
  d: Document,
  r: NormalizedRecipe,
  o: RenderOptions,
  fmt: Fmt,
) {
  const L = o.labels;
  const card = el(d, "article", "cj-card cj-recipe-card");
  const title = el(d, "h3", "cj-title", r.title ?? "");
  if (r.recommended) title.append(el(d, "span", "cj-badge", L.badge));
  const subtitle = [vocabularyLabel(L.methods, r.method), r.brewerLabel]
    .filter(Boolean)
    .join(" · ");
  const grind = r.grind
    ? [
        r.grind.grinderLabel,
        r.grind.setting,
        vocabularyLabel(L.grindSizes, r.grind.size),
        r.grind.micronsApprox !== null ? `~${r.grind.micronsApprox} µm` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const filter = r.filter
    ? [vocabularyLabel(L.filterMaterials, r.filter.material), r.filter.label]
        .filter(Boolean)
        .join(" · ")
    : "";
  const additions = r.additions
    .map((a) =>
      [L.additionKinds[a.kind], fmt(a.amount)].filter(Boolean).join(" · "),
    )
    .filter(Boolean)
    .join(", ");
  const firstTarget = r.steps.findIndex((s) => s.toWater !== null);
  const columnar = r.steps.some(
    (s, i) => s.pourDelta !== null && i !== firstTarget,
  );
  add(
    card,
    title,
    subtitle ? el(d, "p", "cj-subtitle", subtitle) : null,
    ...(r.isEspresso
      ? [
          fact(
            d,
            "dose",
            L.facts.dose,
            [fmt(r.coffee), fmt(r.yield)].filter(Boolean).join(" → "),
          ),
        ]
      : [
          fact(d, "coffee", L.facts.coffee, fmt(r.coffee)),
          fact(d, "water", L.facts.water, fmt(r.water)),
        ]),
    fact(d, "ratio", L.facts.ratio, formatRatio(r.ratio)),
    fact(d, "waterTemp", L.facts.waterTemp, fmt(r.waterTemp)),
    fact(d, "additions", L.facts.additions, additions),
    fact(d, "grind", L.facts.grind, grind),
    fact(d, "filter", L.facts.filter, filter),
    ...(r.isEspresso
      ? [
          fact(d, "pressure", L.facts.pressure, fmt(r.pressure)),
          fact(
            d,
            "preinfusion",
            L.facts.preinfusion,
            r.preinfusionS !== null
              ? `${r.preinfusionS} ${L.brew.seconds}`
              : "",
          ),
          fact(d, "basket", L.facts.basket, r.basketLabel),
        ]
      : []),
    fact(
      d,
      "time",
      r.isEspresso ? L.facts.shotTime : L.facts.finish,
      r.finishS !== null ? fmtClock(r.finishS) : "",
    ),
  );
  if (r.steps.length) {
    const ol = el(d, "ol", "cj-steps");
    r.steps.forEach((_, i) => {
      ol.append(stepItem(d, r, i, columnar, o, fmt));
    });
    card.append(ol);
  }
  if (r.notes) card.append(el(d, "p", "cj-notes", r.notes));
  return card;
}

/**
 * A normalized document as DOM: every bean as a card, then every recipe, then
 * the line naming what generated the document. `null` when there is nothing to
 * show. The facts, their order and their wording are the React cards' own.
 */
export function renderView(
  n: NormalizedDoc,
  o: RenderOptions,
  d: Document,
): HTMLElement | null {
  if (n.beans.length === 0 && n.recipes.length === 0) return null;
  const fmt = formatter(o);
  const view = el(d, "div", "cj-view");
  for (const b of n.beans) view.append(beanCard(d, b, o, fmt));
  for (const r of n.recipes) view.append(recipeCard(d, r, o, fmt));
  const g = n.generator;
  if (g) {
    const p = el(d, "p", "cj-generator", `${o.labels.generatedBy}: `);
    p.append(
      link(d, safeUrl(g.url), [g.name, g.version].filter(Boolean).join(" ")),
    );
    view.append(p);
  }
  return view;
}
