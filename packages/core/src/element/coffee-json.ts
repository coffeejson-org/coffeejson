import type { DecodedDocument, DecodeError, DecodeResult } from "../codec.js";
import { decodeDocumentText, decodePayload, encodePayload } from "../codec.js";
import { documentJsonLd } from "../jsonld.js";
import type { LabelSet, PartialLabels } from "../labels.js";
import { mergeLabels } from "../labels.js";
import { normalize } from "../normalize.js";
import type { UnitSystem } from "../units.js";
import { MEDIA_TYPE } from "../version.js";
import { renderView } from "./render.js";
import { ELEMENT_STYLES } from "./styles.js";

export type { RenderOptions } from "./render.js";
export { renderView } from "./render.js";
export { ELEMENT_STYLES } from "./styles.js";

const UNITS: readonly UnitSystem[] = ["as-authored", "metric", "imperial"];

/** Why no document is on show, either a decoder's reason or a `src` that did not respond. */
type ElementError = DecodeError | { kind: "fetch_failed"; detail?: string };

/**
 * `<coffee-json>` — a CoffeeJSON document as a card, on any page.
 *
 * The document comes from `d`, a share-link payload, or from `src`, a URL that
 * serves one; `d` wins when both are set. The element's own children are its
 * fallback. They show until a document renders, and stay when none does. On a
 * failure the element carries `data-error` with the failure's name and fires
 * `coffeejson-error`; on success it fires `coffeejson-load`. Both events bubble
 * and cross shadow boundaries, so one listener on the page serves every tag.
 */
export class CoffeeJsonElement extends HTMLElement {
  static observedAttributes = [
    "src",
    "d",
    "lang",
    "units",
    "viewer",
    "viewer-label",
    "labels",
    "jsonld",
  ];

  #root: ShadowRoot;
  #doc: DecodedDocument | null = null;
  #jsonLd: HTMLScriptElement | null = null;
  #labels: PartialLabels | null = null;
  #run = 0;
  #connected = false;
  #abort: AbortController | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#fallback();
  }

  /** The document on show, or `null` while the fallback is. */
  get document(): DecodedDocument | null {
    return this.#doc;
  }

  /**
   * Label overrides for a page with script, merged over the English defaults
   * the way the React cards' `config.labels` is. Set, it wins over the
   * `labels` attribute; `null` makes the attribute apply again.
   */
  get labels(): PartialLabels | null {
    return this.#labels;
  }

  set labels(overrides: PartialLabels | null) {
    this.#labels = overrides;
    if (this.#connected) this.#paint();
  }

  connectedCallback(): void {
    this.#connected = true;
    void this.#load();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    this.#abort?.abort();
    this.#jsonLd?.remove();
    this.#jsonLd = null;
  }

  attributeChangedCallback(
    name: string,
    before: string | null,
    after: string | null,
  ): void {
    // An upgrade reports every attribute before the connection, so the connection starts the one load.
    if (!this.#connected || before === after) return;
    // A new source is a new document; everything else redraws the one in hand.
    if (name === "src" || name === "d") void this.#load();
    else this.#paint();
  }

  #fallback(): void {
    this.#root.replaceChildren(this.ownerDocument.createElement("slot"));
  }

  async #load(): Promise<void> {
    const run = ++this.#run;
    this.#abort?.abort();
    const result = await this.#read();
    // A slower answer for an older attribute value must not replace a newer one.
    if (run !== this.#run || !this.isConnected) return;
    let error: ElementError;
    if (result.ok) {
      this.#doc = result.document;
      if (this.#paint()) {
        this.removeAttribute("data-error");
        this.#announce("coffeejson-load");
        return;
      }
      // The document decoded and holds no bean or recipe that can be drawn. A
      // page showing its fallback needs the reason.
      error = { kind: "empty_document" };
    } else error = result.error;
    this.#doc = null;
    this.#paint();
    this.setAttribute("data-error", error.kind);
    this.#announce("coffeejson-error", error);
  }

  #announce(type: string, detail?: ElementError): void {
    this.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true }),
    );
  }

  async #read(): Promise<DecodeResult | { ok: false; error: ElementError }> {
    const d = this.getAttribute("d");
    if (d !== null) return decodePayload(d);
    const src = this.getAttribute("src");
    if (src === null) return decodePayload("");
    this.#abort = new AbortController();
    try {
      const res = await fetch(src, {
        signal: this.#abort.signal,
        headers: { Accept: `${MEDIA_TYPE}, application/json` },
      });
      if (!res.ok)
        return {
          ok: false,
          error: { kind: "fetch_failed", detail: String(res.status) },
        };
      return decodeDocumentText(await res.text());
    } catch {
      return { ok: false, error: { kind: "fetch_failed" } };
    }
  }

  /** Draw the document in hand, or the fallback. Returns whether a document was drawn. */
  #paint(): boolean {
    this.#jsonLd?.remove();
    this.#jsonLd = null;
    const d = this.ownerDocument;
    const doc = this.#doc;
    const units = this.getAttribute("units") as UnitSystem | null;
    const labels = this.#resolveLabels();
    const view = doc
      ? renderView(
          normalize(doc),
          {
            labels,
            units: units && UNITS.includes(units) ? units : "as-authored",
            locale: this.getAttribute("lang") || "en",
          },
          d,
        )
      : null;
    if (!doc || !view) {
      this.#fallback();
      return false;
    }
    const style = d.createElement("style");
    style.textContent = ELEMENT_STYLES;
    this.#root.replaceChildren(style, view, this.#actions(doc, labels));
    if (this.hasAttribute("jsonld")) {
      const nodes = documentJsonLd(doc);
      if (nodes.length) {
        const script = d.createElement("script");
        script.type = "application/ld+json";
        // `<` escaped, so no string in a document can close the tag.
        script.textContent = JSON.stringify(
          nodes.length === 1 ? nodes[0] : nodes,
        ).replace(/</g, "\\u003c");
        d.head.appendChild(script);
        this.#jsonLd = script;
      }
    }
    return true;
  }

  // The page's script sets the property, so it wins over the markup.
  // An attribute that is not a JSON object keeps the defaults and reports nothing:
  // the document is on show, and `data-error` names why one is not.
  #resolveLabels(): LabelSet {
    let overrides = this.#labels;
    const attr = this.getAttribute("labels");
    if (overrides === null && attr !== null) {
      try {
        const parsed: unknown = JSON.parse(attr);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          overrides = parsed as PartialLabels;
      } catch {
        // Not JSON.
      }
    }
    return mergeLabels(overrides ?? undefined);
  }

  #actions(doc: DecodedDocument, labels: LabelSet): HTMLElement {
    const d = this.ownerDocument;
    const row = d.createElement("p");
    row.className = "cj-actions";
    row.setAttribute("part", "cj-actions");
    const save = d.createElement("button");
    save.type = "button";
    save.setAttribute("part", "cj-download");
    save.textContent = labels.actions.download;
    save.addEventListener("click", () => {
      const a = d.createElement("a");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(doc, null, 2)], { type: MEDIA_TYPE }),
      );
      a.href = url;
      a.download = "coffee.json";
      a.click();
      // Safari can start the download after this task, so the URL must outlive it.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    row.append(save);
    // The package picks no host, so the link exists only where the page names
    // a viewer.
    const viewer = this.getAttribute("viewer");
    if (viewer) {
      try {
        // Resolved first, so a path such as `/r/` names a viewer on this site,
        // and the scheme checked is the one the link will have.
        const u = new URL(viewer, d.baseURI);
        if (u.protocol === "http:" || u.protocol === "https:") {
          u.searchParams.set("d", encodePayload(doc));
          const open = d.createElement("a");
          open.href = u.href;
          open.rel = "noopener";
          open.setAttribute("part", "cj-open");
          // The page supplies the words, so the package picks no language either.
          open.textContent = this.getAttribute("viewer-label") || "Open";
          row.append(open);
        }
      } catch {
        // A value such as `https://` does not parse, and adds no link.
      }
    }
    return row;
  }
}

/**
 * Register the element. Safe to call twice. A second name gets its own
 * subclass, because one class can be registered under one name only.
 */
export function defineCoffeeJson(tag = "coffee-json"): void {
  if (customElements.get(tag)) return;
  customElements.define(
    tag,
    tag === "coffee-json"
      ? CoffeeJsonElement
      : class extends CoffeeJsonElement {},
  );
}
