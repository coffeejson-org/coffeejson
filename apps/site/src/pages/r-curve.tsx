import type { NormalizedRecipe } from "@coffeejson/core";
import { useEffect, useMemo, useRef } from "react";
import { curveAt, curveFigure, pourSeries } from "../lib/pour-curve.mjs";

/**
 * The recipe's pour curve. With `elapsedS` it is a clock: the playhead sits at
 * that second and the pours it has passed are filled. Without, it is the whole
 * schedule. Renders nothing for a recipe with no timed pours.
 */
export function PourCurve({
  recipe,
  elapsedS,
}: {
  recipe: NormalizedRecipe;
  elapsedS?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const series = useMemo(() => pourSeries(recipe), [recipe]);
  // `curveFigure` escapes every value it prints, so the string is safe to set.
  // Memoized as the prop object itself: React resets `innerHTML` whenever that
  // object is a new one, which would redraw the figure whole on every render.
  const inner = useMemo(
    () => ({ __html: series ? curveFigure(series) : "" }),
    [series],
  );

  useEffect(() => {
    const figure = ref.current?.querySelector<HTMLElement>(".curve");
    if (!figure || !series) return;
    if (elapsedS === undefined) {
      figure.style.setProperty("--p", "1");
      delete figure.dataset["playing"];
      return;
    }
    const { p, h, current } = curveAt(series, elapsedS);
    figure.dataset["playing"] = "";
    figure.style.setProperty("--p", String(p));
    figure.style.setProperty("--h", String(h));
    figure.querySelectorAll<HTMLElement>(".curve-pt").forEach((pt, i) => {
      pt.classList.toggle("is-pending", i > current);
      pt.classList.toggle("is-active", i === current);
    });
  });

  if (!series) return null;
  return (
    <div ref={ref} className="curve-card" dangerouslySetInnerHTML={inner} />
  );
}
