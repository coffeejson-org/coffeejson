import type { ReactNode } from "react";
import type { ResolvedConfig } from "./config.js";
import { cx } from "./config.js";

/** The frozen fact markup, with no override check: the card rows that are
 *  deliberately not overridable render through this. */
export function FactShell({ id, label, rc, children }: { id: string; label: string; rc: ResolvedConfig; children: ReactNode }) {
  return (
    <div className={cx("fact", rc)} data-cj-fact={id}>
      <span className={cx("factLabel", rc)}>{label}</span>{" "}
      <span className={cx("factValue", rc)}>{children}</span>
    </div>
  );
}

export function Fact({ id, label, value, rc }: { id: string; label: string; value: string; rc: ResolvedConfig }) {
  // Empty-suppression stays the card's job — an override never sees empty facts.
  if (!value) return null;
  const Override = rc.components.Fact;
  if (Override) return <Override id={id} label={label} value={value} />;
  return <FactShell id={id} label={label} rc={rc}>{value}</FactShell>;
}
