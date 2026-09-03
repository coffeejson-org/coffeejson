import { normalize, safeUrl } from "@coffeejson/core";
import { type ReactNode, useMemo } from "react";
import { BeanCard } from "./BeanCard.js";
import type { CoffeeJSONConfig } from "./config.js";
import { cx, resolveConfig } from "./config.js";
import { RecipeCard } from "./RecipeCard.js";

export interface CoffeeJSONViewProps {
  /** Any JSON value — normalize() is the crash-safety boundary; garbage renders renderEmpty(). */
  doc: unknown;
  /** Fallback when nothing renderable survives normalization. Default: render nothing. */
  renderEmpty?: () => ReactNode;
  config?: CoffeeJSONConfig;
}

/**
 * The document's beans and recipes. `normalize` projects tastings too, but no
 * reference component renders one — a tasting card is the consumer's.
 */
export function CoffeeJSONView({
  doc,
  renderEmpty,
  config,
}: CoffeeJSONViewProps) {
  // normalize() builds fresh arrays that are handed on as props, so re-running it
  // on an unchanged `doc` denies everything downstream a stable identity to
  // memoize on — and a view above a running clock re-renders four times a second.
  const n = useMemo(() => normalize(doc), [doc]);
  if (n.beans.length === 0 && n.recipes.length === 0) {
    return <>{renderEmpty ? renderEmpty() : null}</>;
  }
  const rc = resolveConfig(config);
  // `generator` describes the document, so it renders once beneath the cards and
  // never per recipe.
  const g = n.generator;
  const gHref = g ? safeUrl(g.url) : null;
  const gText = g ? [g.name, g.version].filter(Boolean).join(" ") : "";
  return (
    <div className={cx("view", rc)}>
      {rc.show.bean
        ? n.beans.map((b, i) => (
            <BeanCard bean={b} config={config} key={`b${i}`} />
          ))
        : null}
      {n.recipes.map((r, i) => (
        <RecipeCard recipe={r} config={config} key={`r${i}`} />
      ))}
      {rc.show.generator && g ? (
        <p className={cx("generator", rc)}>
          {rc.labels.generatedBy}:{" "}
          {gHref ? (
            <a href={gHref} rel="noopener">
              {gText}
            </a>
          ) : (
            gText
          )}
        </p>
      ) : null}
    </div>
  );
}
