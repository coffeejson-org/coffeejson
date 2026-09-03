import type { NormalizedBean, NormalizedOriginItem } from "@coffeejson/core";
import {
  originLine,
  processLine,
  safeUrl,
  vocabularyLabel,
} from "@coffeejson/core";
import type { CoffeeJSONConfig, ResolvedConfig } from "./config.js";
import { cx, fmt, resolveConfig } from "./config.js";
import { Fact, FactShell } from "./Fact.js";

// The origin line is the format's, and altitude is a measurement: it renders
// through the config like every other one, so `units` and `locale` reach it.
const originText = (it: NormalizedOriginItem, rc: ResolvedConfig): string =>
  originLine(it, rc.labels, (m) => fmt(m, rc));

export interface BeanCardProps {
  bean: NormalizedBean;
  config?: CoffeeJSONConfig;
}

export function BeanCard({ bean: b, config }: BeanCardProps) {
  const rc = resolveConfig(config);
  // The roaster's own page is the link this line is about; the bag's page is
  // what it falls back to when the transcription named only that.
  const href = safeUrl(b.roaster?.url) || safeUrl(b.url);
  const roasterText = b.roaster?.name ?? b.url ?? "";
  const roastLine = [
    // `roast_level` has no `other` to fall back to: an unrecognized value is
    // ignored in favor of `roast_agtron`, so it drops out of the line here.
    vocabularyLabel(rc.labels.roastLevels, b.roastLevel),
    b.roastAgtron !== null ? `${rc.labels.facts.agtron} ${b.roastAgtron}` : "",
    b.roastDate ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className={`${cx("card", rc)} ${cx("beanCard", rc)}`}>
      <h3 className={cx("title", rc)}>{b.name || rc.labels.beanFallback}</h3>
      {roasterText ? (
        <FactShell id="roaster" label={rc.labels.facts.roaster} rc={rc}>
          {href ? (
            <a href={href} rel="noopener">
              {roasterText}
            </a>
          ) : (
            roasterText
          )}
        </FactShell>
      ) : null}
      {b.originItems.length > 0 ? (
        <FactShell id="origin" label={rc.labels.facts.origin} rc={rc}>
          {b.originItems.map((it, i) => (
            <span className={cx("originItem", rc)} key={i}>
              {originText(it, rc)}
            </span>
          ))}
        </FactShell>
      ) : null}
      {/* `drying_method` is a free string, not a vocabulary: the spec says pass it
          through verbatim, so it is the roaster's word and not this card's. */}
      <Fact
        id="process"
        label={rc.labels.facts.process}
        value={[processLine(b.process, rc.labels), b.dryingMethod ?? ""]
          .filter(Boolean)
          .join(" · ")}
        rc={rc}
      />
      <Fact
        id="varietals"
        label={rc.labels.facts.varietals}
        value={b.varietals.join(", ")}
        rc={rc}
      />
      <Fact
        id="roast"
        label={rc.labels.facts.roast}
        value={roastLine}
        rc={rc}
      />
      {b.roasterNotes.length > 0 ? (
        <FactShell
          id="roasterNotes"
          label={rc.labels.facts.roasterNotes}
          rc={rc}
        >
          <em className={cx("notes", rc)}>{b.roasterNotes.join(", ")}</em>
        </FactShell>
      ) : null}
      {b.description ? (
        <p className={cx("description", rc)}>{b.description}</p>
      ) : null}
    </article>
  );
}
