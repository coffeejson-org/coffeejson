import type { DecodedDocument, NormalizedRecipe } from "@coffeejson/core";
import {
  decodePayload,
  normalize,
  payloadFromLocation,
  scopeToBean,
  scopeToRecipe,
} from "@coffeejson/core";
import { BeanCard, RecipeCard } from "@coffeejson/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@coffeejson/react/styles.css";
import { docJsonLd, injectJsonLd } from "../lib/jsonld";
import type { CorpusEntry, DocumentIndex, ShortLink } from "../lib/short-link";
import { payloadForShortLink, shortLinkFromSearch } from "../lib/short-link";
import { Brew } from "./r-brew";
import { PourCurve } from "./r-curve";
import type { Mode } from "./r-shared";
import { Fail, footer, header, SaveCta } from "./r-shared";

export function App({
  doc,
  initialMode = { kind: "view" },
}: {
  doc: DecodedDocument;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const n = normalize(doc);

  /**
   * One share row per card, offered only where its projection DIFFERS from the
   * document and only when the normalized view and the raw document agree on the
   * recipe count: `normalize` drops non-object entries, and a row pointing one
   * recipe off would be a silent lie.
   */
  const scoped = useMemo(() => {
    const aligned =
      (doc.recipes?.length ?? 0) === n.recipes.length &&
      (doc.beans?.length ?? 0) === n.beans.length;
    if (!aligned) return null;
    const whole = JSON.stringify(doc);
    const narrower = (part: DecodedDocument | null) =>
      part && JSON.stringify(part) !== whole ? part : null;
    return {
      beans: n.beans.map((_, i) => narrower(scopeToBean(doc, i))),
      recipes: n.recipes.map((_, i) => narrower(scopeToRecipe(doc, i))),
    };
  }, [doc, n.beans.length, n.recipes.length]);

  // Deliberately without a `url`: this page's address is either a
  // robots-disallowed `?d=` payload or a `?s=` short link, and the shell
  // canonicalizes both to bare `/r/`.
  useEffect(() => {
    injectJsonLd(docJsonLd(doc));
  }, [doc]);

  // Tab title / bookmark name follows the shared content, not the static "Recipe —".
  useEffect(() => {
    const title = n.recipes[0]?.title ?? n.beans[0]?.name;
    if (title) document.title = `${title} — CoffeeJSON`;
  }, [doc]);

  // Coming back from a brew puts focus on the button that started it: the
  // screen was replaced under a keyboard reader, and without this they are
  // returned to the top of the page.
  const cameFrom = useRef<number | null>(null);
  useEffect(() => {
    if (mode.kind !== "view" || cameFrom.current === null) return;
    document
      .querySelector<HTMLElement>(`[data-start-brew="${cameFrom.current}"]`)
      ?.focus();
    cameFrom.current = null;
  }, [mode]);

  if (mode.kind === "brew") {
    return (
      <Brew
        doc={doc}
        recipe={n.recipes[mode.index]!}
        onBack={() => {
          cameFrom.current = mode.index;
          setMode({ kind: "view" });
        }}
      />
    );
  }

  // A document that is one recipe is headed by it, and the card's own copy of
  // the title steps aside. Anything larger has no single name to put there.
  const solo = n.recipes.length === 1 && n.beans.length === 0;

  return (
    <>
      {header}
      {solo ? <h1>{n.recipes[0]!.title}</h1> : null}
      <div className="cj-view" data-solo={solo ? "" : undefined}>
        {n.beans.map((b, i) => (
          <div className="cj-recipe-block" key={`b${i}`}>
            <BeanCard bean={b} />
            {scoped?.beans[i] ? (
              <SaveCta
                doc={scoped.beans[i]!}
                prominent={false}
                variant="row"
                label="Take the bag on its own"
              />
            ) : null}
          </div>
        ))}
        {n.recipes.map((r: NormalizedRecipe, i) => (
          <div className="cj-recipe-block" key={`r${i}`}>
            {r.steps.length > 0 ? (
              <p>
                <button
                  type="button"
                  className="btn btn--lg"
                  data-start-brew={i}
                  onClick={() => setMode({ kind: "brew", index: i })}
                >
                  Start brewing
                </button>
              </p>
            ) : null}
            <PourCurve recipe={r} />
            <RecipeCard recipe={r} />
            {scoped?.recipes[i] ? (
              <SaveCta
                doc={scoped.recipes[i]!}
                prominent={false}
                variant="row"
                label={
                  scoped.recipes[i]!.beans?.length
                    ? "Take this brew and the bag"
                    : "Take this brew on its own"
                }
              />
            ) : null}
          </div>
        ))}
      </div>
      <SaveCta doc={doc} prominent={false} />
      {footer}
    </>
  );
}

function FromPayload({ raw }: { raw: string }) {
  const result = decodePayload(raw);
  if (!result.ok)
    return <Fail kind={result.error.kind} detail={result.error.detail} />;
  const n = normalize(result.document);
  // The envelope passed but `normalize` dropped every entry, so this is the
  // empty-document reason, not "this isn't a CoffeeJSON document".
  if (n.beans.length === 0 && n.recipes.length === 0)
    return <Fail kind="empty_document" />;
  return <App doc={result.document} />;
}

// `&i=N` narrows a `?s=` slug to that card's own recipe. Both indexes are
// code-split, so the canonical `?d=` path never pays for either.
function FromSlug({ link }: { link: ShortLink }) {
  const [state, setState] = useState<
    { raw: string } | { missing: true } | null
  >(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      import("../generated/recipes-index.json"),
      import("../generated/documents-index.json"),
    ]).then(([cards, documents]) => {
      if (!live) return;
      const payload = payloadForShortLink(
        cards.default as CorpusEntry[],
        documents.default as DocumentIndex,
        link,
      );
      setState(payload === null ? { missing: true } : { raw: payload });
    });
    return () => {
      live = false;
    };
  }, [link.slug, link.index]);
  if (state === null) return null;
  if ("missing" in state) return <Fail kind="unknown_slug" />;
  return <FromPayload raw={state.raw} />;
}

function Root() {
  const raw = payloadFromLocation(location.search);
  if (raw !== null) return <FromPayload raw={raw} />;
  const link = shortLinkFromSearch(location.search);
  if (link !== null) return <FromSlug link={link} />;
  return <Fail kind="no_payload" />;
}

// Guarded so importing this module never triggers the mount side effect.
const mount =
  typeof document === "undefined"
    ? null
    : document.querySelector<HTMLElement>("#app");
if (mount) createRoot(mount).render(<Root />);
