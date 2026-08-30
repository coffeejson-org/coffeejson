import type { ReactNode } from "react";
import type { NormalizedRecipe, NormalizedStep } from "@coffeejson/core";
import { fmtClock, fmtStepTime, formatRatio, safeUrl, vocabularyLabel } from "@coffeejson/core";
import type { CoffeeJSONConfig, ResolvedConfig } from "./config.js";
import { cx, fmt, pourAmount, resolveConfig } from "./config.js";
import { Fact } from "./Fact.js";

// A `components.Badge` override replaces this span outright, as `Fact` does.
function Badge({ rc }: { rc: ResolvedConfig }) {
  const Override = rc.components.Badge;
  const label = rc.labels.badge;
  if (Override) return <Override label={label} />;
  return <span className={cx("badge", rc)}>{label}</span>;
}

function StepItem(
  { step, index, active, rc, columnar, pour }: {
    step: NormalizedStep; index: number; active: boolean; rc: ResolvedConfig;
    // The recipe has a pour increment beyond its initial fill, so every row
    // lays its water out as siblings (Pour · Total columns).
    columnar: boolean;
    // This row's pour amount as it reads on screen, empty when there is none.
    pour: string;
  },
) {
  const time = fmtStepTime(step.atS);
  // `pour` is the kind a step means when it states none, so tagging a pour row
  // says nothing. Every other kind reads as its label, never as its token.
  const kind = step.kind && step.kind !== "pour"
    ? `[${vocabularyLabel(rc.labels.stepKinds, step.kind)}] `
    : "";
  const liClass = active ? `${cx("step", rc)} ${cx("stepActive", rc)}` : cx("step", rc);

  // Plain rendering, the target nested inside the body: every row of a recipe with
  // no increment beyond its initial fill takes this.
  if (!columnar) {
    return (
      <li className={liClass} data-step={index}>
        <span className={cx("stepTime", rc)}>{time}</span>
        <span className={cx("stepBody", rc)}>
          {kind}
          {step.text}
          {step.toWater ? <strong className={cx("stepTarget", rc)}> {fmt(step.toWater, rc)}</strong> : null}
        </span>
      </li>
    );
  }

  // Columnar rendering: delta and target are siblings of stepBody, not nested, so a
  // consumer can grid them into aligned Pour · Total columns. Only targeted rows.
  let water: ReactNode = null;
  if (step.toWater) {
    const target = <strong className={cx("stepTarget", rc)}>{fmt(step.toWater, rc)}</strong>;
    // With no amount to state, the placeholder — collapsing misaligns the grid.
    const delta = pour
      ? <span className={cx("stepDelta", rc)}>{pour}</span>
      : <span className={`${cx("stepDelta", rc)} ${cx("stepDeltaNone", rc)}`}>—</span>;
    water = (
      <>
        {delta}
        {" "}
        {target}
      </>
    );
  }

  return (
    <li className={liClass} data-step={index}>
      <span className={cx("stepTime", rc)}>{time}</span>
      <span className={cx("stepBody", rc)}>{kind}{step.text}</span>
      {water !== null ? <>{" "}{water}</> : null}
    </li>
  );
}

export interface RecipeCardProps {
  recipe: NormalizedRecipe;
  /** Highlight only — time-keeping stays the consumer's job; see `useBrewAlong`. */
  activeStepIndex?: number | null;
  config?: CoffeeJSONConfig;
}

export function RecipeCard({ recipe: r, activeStepIndex = null, config }: RecipeCardProps) {
  const rc = resolveConfig(config);
  const methodText = vocabularyLabel(rc.labels.methods, r.method);
  // Espresso keeps a single dose row (coffee → yield); pour-over splits into
  // separate Coffee and Water rows.
  const espressoDose = [fmt(r.coffee, rc), fmt(r.yield, rc)].filter(Boolean).join(" → ");
  const grind = r.grind
    ? [
        r.grind.grinderLabel,
        r.grind.setting,
        vocabularyLabel(rc.labels.grindSizes, r.grind.size),
        r.grind.micronsApprox !== null ? `~${r.grind.micronsApprox} µm` : "",
      ].filter(Boolean).join(" · ")
    : "";
  // Material first: it is what changes the cup, and the label only names the
  // product. An unrecognized material reads as `other`, never as a raw slug.
  const filterText = r.filter
    ? [vocabularyLabel(rc.labels.filterMaterials, r.filter.material), r.filter.label]
        .filter(Boolean).join(" · ")
    : "";
  const additionsText = r.additions
    .map((a) => [rc.labels.additionKinds[a.kind], fmt(a.amount, rc)].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join(", ");
  const subtitle = rc.show.gear ? [methodText, r.brewerLabel].filter(Boolean).join(" · ") : "";
  const showEspressoBlock = r.isEspresso && rc.show.espresso;
  // The Pour column appears only when the recipe has an increment beyond its
  // initial fill, so a single-pour recipe never grows an empty delta column.
  const firstTargetIndex = r.steps.findIndex((s) => s.toWater !== null);
  const hasIncrement = r.steps.some((s, i) => s.pourDelta !== null && i !== firstTargetIndex);
  return (
    <article className={`${cx("card", rc)} ${cx("recipeCard", rc)}`}>
      <h3 className={cx("title", rc)}>
        {r.title}
        {r.recommended ? <Badge rc={rc} /> : null}
      </h3>
      {subtitle ? <p className={cx("subtitle", rc)}>{subtitle}</p> : null}
      {r.isEspresso ? (
        <Fact id="dose" label={rc.labels.facts.dose} value={espressoDose} rc={rc} />
      ) : (
        <>
          <Fact id="coffee" label={rc.labels.facts.coffee} value={fmt(r.coffee, rc)} rc={rc} />
          <Fact id="water" label={rc.labels.facts.water} value={fmt(r.water, rc)} rc={rc} />
        </>
      )}
      <Fact id="ratio" label={rc.labels.facts.ratio} value={formatRatio(r.ratio)} rc={rc} />
      <Fact id="waterTemp" label={rc.labels.facts.waterTemp} value={fmt(r.waterTemp, rc)} rc={rc} />
      {r.additions.length > 0 ? (
        <Fact id="additions" label={rc.labels.facts.additions} value={additionsText} rc={rc} />
      ) : null}
      {rc.show.grind ? <Fact id="grind" label={rc.labels.facts.grind} value={grind} rc={rc} /> : null}
      {rc.show.gear ? <Fact id="filter" label={rc.labels.facts.filter} value={filterText} rc={rc} /> : null}
      {showEspressoBlock ? (
        <>
          <Fact id="pressure" label={rc.labels.facts.pressure} value={fmt(r.pressure, rc)} rc={rc} />
          <Fact
            id="preinfusion"
            label={rc.labels.facts.preinfusion}
            value={r.preinfusionS !== null ? `${r.preinfusionS} ${rc.labels.brew.seconds}` : ""}
            rc={rc}
          />
          {rc.show.gear ? <Fact id="basket" label={rc.labels.facts.basket} value={r.basketLabel} rc={rc} /> : null}
        </>
      ) : null}
      <Fact
        id="time"
        label={r.isEspresso ? rc.labels.facts.shotTime : rc.labels.facts.finish}
        value={r.finishS !== null ? fmtClock(r.finishS) : ""}
        rc={rc}
      />
      {rc.show.steps && r.steps.length > 0 ? (
        <ol className={cx("steps", rc)}>
          {r.steps.map((s, i) => (
            <StepItem
              key={i}
              step={s}
              index={i}
              active={i === activeStepIndex}
              rc={rc}
              columnar={hasIncrement}
              pour={pourAmount(r.steps, i, rc)}
            />
          ))}
        </ol>
      ) : null}
      {r.notes ? <p className={cx("notes", rc)}>{r.notes}</p> : null}
    </article>
  );
}
