import { useEffect, useRef } from "react";
import type { DecodeError, DecodedDocument } from "@coffeejson/core";
import { defaultLabels } from "@coffeejson/core";
import { saveCta, wireSaveCta } from "../lib/save";
import { GITHUB_URL, NAV } from "../lib/site-header.mjs";

// Centralized so r.tsx and r-brew.tsx never need to import each other.

// The codec's twelve reasons are worded in the package, so a reason the format
// grows reaches a reader without this page being edited. `unknown_slug` is the
// site's alone: `?s=` resolves against a directory the format knows nothing of.
const SITE_COPY = {
  unknown_slug: "This short link points at a recipe that is not in the directory any more.",
};

export type FailKind = DecodeError["kind"] | keyof typeof SITE_COPY;

export const failCopy = (kind: FailKind): string =>
  kind in SITE_COPY
    ? SITE_COPY[kind as keyof typeof SITE_COPY]
    : defaultLabels.decodeErrors[kind as DecodeError["kind"]];

export const header = (
  <header className="site-header">
    <a href="/"><strong>CoffeeJSON</strong></a>
    {NAV.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
    <a href={GITHUB_URL} rel="noopener">GitHub</a>
  </header>
);

export type Mode = { kind: "view" } | { kind: "brew"; index: number };

// `saveCta` returns registry-sourced, esc-escaped HTML with no unescaped payload,
// so dangerouslySetInnerHTML is safe here; `wireSaveCta` wires the buttons after.
export function SaveCta({ doc, prominent, variant, label }: {
  doc: DecodedDocument;
  prominent: boolean;
  /** `row` is the compact per-card share; `panel` (default) is the page's own. */
  variant?: "panel" | "row";
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) wireSaveCta(ref.current, doc);
  }, [doc]);
  return (
    <div
      ref={ref}
      dangerouslySetInnerHTML={{
        __html: saveCta(doc, variant ? { prominent, variant, ...(label ? { label } : {}) } : { prominent }),
      }}
    />
  );
}

export function Fail({ kind, detail }: { kind: FailKind; detail?: string }) {
  return (
    <>
      {header}
      <h1>Can’t show this recipe</h1>
      <div className="error">
        <p>{failCopy(kind)}{detail ? <span className="muted"> ({detail})</span> : null}</p>
        {kind === "unknown_slug"
          ? <p>Browse the <a href="/recipes/">recipe directory</a> for the current corpus.</p>
          : <p>Paste the link into the <a href="/validator/">validator</a> to see what’s wrong.</p>}
      </div>
      <p className="muted">What is this? <a href="/">CoffeeJSON</a> is an open format for sharing coffee recipes as data.</p>
    </>
  );
}
