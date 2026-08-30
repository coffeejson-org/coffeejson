import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  buildBean, buildDocument, collectDroppedPaths, documentToState, emptyBeanForm, emptyOriginItemForm,
  emptyRecipeForm, emptyStepForm, num, perPourAmounts, stepsNonDecreasing,
} from "../lib/builder";
import type { BeanFormState, RecipeFormState } from "../lib/builder";
import { documentFromInput } from "../lib/input-document";
import { validateDocument } from "../lib/validate";
import type { ValidationIssue } from "../lib/validate";
import { esc, plural } from "../lib/text.mjs";
import { saveCta, wireSaveCta } from "../lib/save";
import {
  BREW_METHODS, FILTER_MATERIALS, FORMAT_VERSION, defaultLabels, encodePayload, methodLabel,
  vocabularyLabel,
} from "@coffeejson/core";
import type { CoffeeJSONDocument } from "@coffeejson/core";
import { CoffeeJSONView } from "@coffeejson/react";
import "@coffeejson/react/styles.css";
import { SAMPLE_DOC } from "../lib/sample";
import { siteHeader } from "../lib/site-header.mjs";

const app = document.querySelector<HTMLElement>("#app")!;
const header = siteHeader("/generate/");

// The vocabularies come from the package, so a form option list cannot fall
// behind the format. The leading "" is this form's own "not stated" row.
const METHOD_OPTS = ["", ...BREW_METHODS];
const FILTER_OPTS = ["", ...FILTER_MATERIALS];

// An all-blank bean panel is omitted from the document. `num()` turns non-numeric
// input into undefined, since NaN would print "+NaN g" and make every
// stepsNonDecreasing() comparison silently false.
const bean: BeanFormState = emptyBeanForm();
let beanOpen = false; // <details> open/closed, remembered across structural re-renders

// The page opens on the sample, because a filled form answers "what does this
// do?" and an empty one does not; `Clear the form` makes the prefill safe. The
// sample states no steps, but the form shows one blank row — dropped by
// buildSteps — to keep the timed-pour schedule visible.
const blankRecipe = (): RecipeFormState => ({ ...emptyRecipeForm(), method: "pour_over", steps: [emptyStepForm()] });
const sampleRecipes = (): RecipeFormState[] =>
  documentToState(SAMPLE_DOC).recipeForms.map((r) => ({ ...r, steps: r.steps.length ? r.steps : [emptyStepForm()] }));

const recipes: RecipeFormState[] = sampleRecipes();

// `renderAll()` replaces `app.innerHTML` wholesale, destroying the `#preview` node,
// so the root is recreated there and never cached across calls. `refreshFeedback()`
// only ever calls `.render()` on whichever root is current.
let previewRoot: Root | undefined;

// A TWO-WAY view: form edits write into the textarea and textarea edits parse back
// into the form. `jsonFocused` stops the two fighting — while the caret is in the
// textarea the form never overwrites what is being typed.
let jsonText = "";
let jsonNotice = "";
let jsonFocused = false;
let jsonTimer: ReturnType<typeof setTimeout> | undefined;

const prettyDoc = (doc: unknown): string => JSON.stringify(doc, null, 2);

// An untouched form shows the preview's empty state rather than six schema errors.
// One capture-phase listener on the page root covers every field and is attached
// once, because `app` outlives re-renders. Only the TRANSITION matters, and it must
// redraw: a non-parsing keystroke never reaches refreshFeedback().
let touched = true; // the page opens pre-filled, so the empty state would be a lie
const markTouched = () => { if (!touched) { touched = true; renderPreview(); } };
app.addEventListener("input", markTouched, true);
app.addEventListener("change", markTouched, true);

const issuesHtml = (issues: ValidationIssue[]): string =>
  `<div class="error"><p><strong>${plural(issues.length, "problem")} — not loaded</strong></p>
    <ul>${issues.map((i) => `<li><code>${esc(i.path)}</code> ${esc(i.message)}</li>`).join("")}</ul></div>`;

// In place, because `bean`/`recipes` are `const` bindings wireForm()'s closures
// already hold. Only one bean panel exists, so a multi-bean document keeps the
// first — data loss on re-share, which the drop-warning below names.
function loadDocumentIntoForm(doc: CoffeeJSONDocument, opts: { fromJson?: boolean } = {}): void {
  const state = documentToState(doc);
  Object.assign(bean, state.beanForms[0] ?? emptyBeanForm());
  recipes.splice(0, recipes.length, ...state.recipeForms);
  beanOpen = Object.keys(buildBean(bean)).length > 0;
  touched = true;
  // The spec's re-authoring honesty rule, applied to our own builder: editing here
  // re-authors the document without whatever the form cannot carry.
  const rebuilt = buildDocument({ beanForms: state.beanForms.slice(0, 1), recipeForms: state.recipeForms });
  const dropped = collectDroppedPaths(doc, rebuilt);
  if (dropped.length) {
    const shown = dropped.slice(0, 12).map((p) => `<code>${esc(p)}</code>`).join(", ");
    const more = dropped.length > 12 ? ` and ${dropped.length - 12} more` : "";
    jsonNotice = `<div class="banner"><strong>Loaded, with fields left behind.</strong>
      This form can’t carry ${shown}${more} — sharing from here re-authors the document without
      ${dropped.length === 1 ? "it" : "them"}. To keep everything, share the original link or file unchanged.</div>`;
  } else {
    jsonNotice = `<div class="banner">Loaded into the form.</div>`;
  }
  // A load driven by TYPING must not rebuild the textarea — that is the field
  // the caret is in. Only the form and the notice are redrawn.
  if (opts.fromJson) { renderForm(); paintJsonNotice(); } else { renderAll(); }
}

// Only ever populates the form on a clean pass; `validateDocument` is the only
// validator anywhere on this page. `fromJson` marks an attempt driven by typing in
// the textarea, which must leave the textarea alone on every outcome.
function tryLoad(text: string, fromJson: boolean): void {
  const { doc, error } = documentFromInput(text, "Nothing to import yet.");
  const fail = (html: string) => {
    jsonNotice = html;
    if (fromJson) paintJsonNotice(); else renderAll();
  };
  if (error) return fail(`<div class="error">${esc(error)}</div>`);
  const issues = validateDocument(doc);
  if (issues.length) return fail(issuesHtml(issues));
  loadDocumentIntoForm(doc as CoffeeJSONDocument, { fromJson });
}

// A dropped file, paste or file pick is re-serialized pretty-printed, because a
// share URL or a minified blob is not something a person can edit. Typing takes the
// other branch: text reflowed under the cursor is its own kind of unusable.
function loadFromSource(text: string): void {
  jsonText = text;
  const { doc } = documentFromInput(text, "Nothing to import yet.");
  if (doc !== undefined && !validateDocument(doc).length) jsonText = prettyDoc(doc);
  tryLoad(text, false);
  revealPreview();
}

// "Did it read my document correctly" is the one question a paste asks, and on a
// phone the preview sits a screen down. A no-op on a wide viewport. Only source
// loads scroll; typing must never yank the page out from under a caret.
function revealPreview(): void {
  const el = app.querySelector<HTMLElement>(".gen-preview");
  if (!el) return;
  const { top, bottom } = el.getBoundingClientRect();
  if (top >= 0 && bottom <= window.innerHeight) return;
  el.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function paintJsonNotice(): void {
  const el = app.querySelector<HTMLElement>("#jsonresult");
  if (el) el.innerHTML = jsonNotice;
}

// Skipped while the caret is in the field — the whole reason both directions can
// coexist.
function syncJsonFromForm(): void {
  if (jsonFocused) return;
  jsonText = prettyDoc(currentDocument());
  const el = app.querySelector<HTMLTextAreaElement>("#jsoninput");
  if (el && el.value !== jsonText) el.value = jsonText;
}

function jsonPanelHtml(): string {
  return `<section class="card gen-json" id="jsonpanel">
    <h2>The document</h2>
    <p class="muted">Edits here and edits in the form are the same document — type in either.
    Paste a share URL (<code>…/r?d=…</code>) or drop a <code>.json</code> file to load one.</p>
    <textarea id="jsoninput" class="field" spellcheck="false"
      placeholder='{"coffeejson": "${FORMAT_VERSION}", …}  or  https://coffeejson.org/r?d=…'>${esc(jsonText)}</textarea>
    <div id="jsondrop" class="card dropzone">
      Drop a <code>.json</code> file here, or
      <label class="btn btn--ghost">browse<input type="file" id="jsonfile" class="visually-hidden" accept=".json,application/json"></label>
    </div>
    <div id="jsonresult">${jsonNotice}</div>
  </section>`;
}

function wireJsonPanel(): void {
  const input = app.querySelector<HTMLTextAreaElement>("#jsoninput")!;
  input.addEventListener("focus", () => { jsonFocused = true; });
  input.addEventListener("blur", () => { jsonFocused = false; syncJsonFromForm(); });
  // Debounced: rebuilding the form on every keystroke would fight a half-typed
  // number, and every intermediate state of a hand-edited document is invalid.
  input.addEventListener("input", () => {
    jsonText = input.value;
    if (jsonTimer) clearTimeout(jsonTimer);
    jsonTimer = setTimeout(() => {
      if (!input.value.trim()) { jsonNotice = ""; paintJsonNotice(); return; }
      tryLoad(input.value, true);
    }, 400);
  });
  // A paste replaces the whole field, so it is treated as a source load — the
  // pasted share URL or minified blob comes back pretty-printed and editable.
  input.addEventListener("paste", (e) => {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text.trim() || input.selectionStart !== 0 || input.selectionEnd !== input.value.length) return;
    e.preventDefault();
    if (jsonTimer) clearTimeout(jsonTimer);
    loadFromSource(text);
  });
  const drop = app.querySelector<HTMLElement>("#jsondrop")!;
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.style.borderColor = "var(--accent)"; });
  drop.addEventListener("dragleave", () => { drop.style.borderColor = ""; });
  drop.addEventListener("drop", async (e) => {
    e.preventDefault();
    drop.style.borderColor = "";
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    loadFromSource(await file.text());
  });
  app.querySelector<HTMLInputElement>("#jsonfile")!.addEventListener("change", async (e) => {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    loadFromSource(await file.text());
  });
}

function currentBeanForms(): BeanFormState[] {
  return Object.keys(buildBean(bean)).length ? [bean] : [];
}
function currentDocument(): CoffeeJSONDocument {
  return buildDocument({ beanForms: currentBeanForms(), recipeForms: recipes });
}

const beanField = (label: string, key: keyof BeanFormState, extra = ""): string =>
  `<label class="gen-field"><span class="muted">${esc(label)}</span>
     <input class="field" data-bk="${String(key)}" value="${esc(String(bean[key] ?? ""))}" ${extra}></label>`;

function originRowsForm(): string {
  return bean.origin.map((o, i) => `
    <li class="gen-step" data-i="${i}">
      <input class="field" data-ok="name" data-i="${i}" placeholder="component name" value="${esc(o.name)}">
      <input class="field field--sm" data-ok="country" data-i="${i}" placeholder="country (ISO-2)" value="${esc(o.country)}">
      <input class="field" data-ok="region" data-i="${i}" placeholder="region" value="${esc(o.region)}">
      <input class="field" data-ok="process" data-i="${i}" placeholder="process" value="${esc(o.process)}">
      <input class="field field--xs" data-ok="percentage" data-i="${i}" placeholder="%" value="${esc(o.percentage)}">
      <button class="btn btn--ghost" data-delorigin="${i}"
        aria-label="Remove origin component ${i + 1}">✕</button>
    </li>`).join("");
}

function beanPanelHtml(): string {
  return `<details class="card" id="beanpanel"${beanOpen ? " open" : ""}>
    <summary>Bean <span class="muted">(optional — fill in for a bag-to-brew bundle)</span></summary>
    ${beanField("Name", "name")}
    ${beanField("Roaster", "roaster")}
    ${beanField("URL", "url")}
    ${beanField("Process", "process")}
    ${beanField("Roast level", "roastLevel")}
    ${beanField("Description", "description")}
    <h3>Origin</h3>
    <ol class="steps">${originRowsForm()}</ol>
    <button class="btn btn--ghost" id="addorigin">+ origin item</button>
  </details>`;
}

const recipeField = (ri: number, label: string, key: keyof RecipeFormState, extra = ""): string => {
  const r = recipes[ri]!;
  return `<label class="gen-field"><span class="muted">${esc(label)}</span>
     <input class="field" data-rk="${String(key)}" data-r="${ri}" value="${esc(String(r[key] ?? ""))}" ${extra}></label>`;
};

function stepRowsForm(ri: number): string {
  return recipes[ri]!.steps.map((s, i) => `
    <li class="gen-step" data-r="${ri}" data-i="${i}">
      <input class="field field--sm" data-sk="at_s" data-r="${ri}" data-i="${i}" placeholder="time s" value="${esc(s.at_s)}">
      <input class="field field--md" data-sk="cumulative" data-r="${ri}" data-i="${i}" placeholder="cumulative g" value="${esc(s.cumulative)}">
      <input class="field" data-sk="instruction" data-r="${ri}" data-i="${i}" placeholder="instruction" value="${esc(s.instruction)}">
      <span class="muted" data-perpour data-r="${ri}" data-i="${i}"></span>
      <button class="btn btn--ghost" data-delstep data-r="${ri}" data-i="${i}"
        aria-label="Remove step ${i + 1} of recipe ${ri + 1}">✕</button>
    </li>`).join("");
}

// The FORM is rendered once and left stable, so typing never loses focus. Only the
// live feedback is recomputed on input; a full re-render happens ONLY on structural
// changes, where the field set itself changes shape.
function recipeHtml(ri: number): string {
  const r = recipes[ri]!;
  const espresso = r.method === "espresso";
  return `<section class="card">
      <div class="row">
        <h2>Recipe ${ri + 1}</h2>
        <button class="btn btn--ghost" data-delrecipe="${ri}">✕ remove recipe</button>
      </div>
      ${recipeField(ri, "Title", "title")}
      <label class="gen-field"><span class="muted">Method</span>
        <select class="field" data-rk="method" data-r="${ri}">${METHOD_OPTS.map((m) =>
          `<option value="${m}"${r.method === m ? " selected" : ""}>${m ? methodLabel(m) : "—"}</option>`).join("")}</select></label>
      ${recipeField(ri, "Brewer", "brewerLabel")}
      ${recipeField(ri, "Coffee (g)", "coffee")}
      ${espresso
        ? recipeField(ri, "Yield (g)", "yield") + recipeField(ri, "Pressure (bar)", "pressure") + recipeField(ri, "Pre-infusion (s)", "preinfusion_s") + recipeField(ri, "Basket", "basketLabel")
        : recipeField(ri, "Water (g)", "water") + recipeField(ri, "Ratio (1:n)", "ratio")}
      ${recipeField(ri, "Water temp (°C)", "waterTempC")}
      ${recipeField(ri, "Grind", "grindSetting")}
      <label class="gen-field"><span class="muted">Filter</span>
        <select class="field" data-rk="filterMaterial" data-r="${ri}">${
          FILTER_OPTS.map((m) =>
            `<option value="${m}"${r.filterMaterial === m ? " selected" : ""}>${m ? vocabularyLabel(defaultLabels.filterMaterials, m) : "—"}</option>`).join("")
        }</select></label>
      ${r.filterMaterial ? recipeField(ri, "Filter label", "filterLabel") : ""}
      ${recipeField(ri, "Originally published at", "basedOn")}
      ${recipeField(ri, espresso ? "Shot time (s)" : "Finish (s)", "finish_s")}
      <label class="gen-field"><span class="muted">Recommended</span>
        <input type="checkbox" data-rcheck="${ri}" ${r.recommended ? "checked" : ""}></label>
    </section>
    <section class="card"><h2>Steps (Recipe ${ri + 1})</h2>
      <ol class="steps">${stepRowsForm(ri)}</ol>
      <div id="guard-${ri}"></div>
      <button class="btn btn--ghost" data-addstep="${ri}">+ step</button>
    </section>`;
}

function formHtml(): string {
  return `<div class="row">
      <button class="btn btn--ghost" id="clearform">Clear the form</button>
      <button class="btn btn--ghost" id="loadsample">Load the example</button>
    </div>
    ${beanPanelHtml()}
    ${recipes.map((_, ri) => recipeHtml(ri)).join("")}
    <button class="btn btn--ghost" id="addrecipe">+ recipe</button>`;
}

type PreviewState =
  | { kind: "empty" }
  | { kind: "issues"; issues: ValidationIssue[] }
  | { kind: "valid"; doc: CoffeeJSONDocument };

function previewState(): PreviewState {
  const doc = currentDocument();
  const issues = validateDocument(doc);
  if (issues.length) return touched ? { kind: "issues", issues } : { kind: "empty" };
  return { kind: "valid", doc };
}

// Safe for the reason r-shared.tsx's SaveCta gives, which this mirrors.
function SaveCtaBlock({ doc }: { doc: CoffeeJSONDocument }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) wireSaveCta(ref.current, doc); }, [doc]);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: saveCta(doc, { prominent: false }) }} />;
}

function Preview({ state }: { state: PreviewState }) {
  if (state.kind === "empty")
    return <p className="muted">Fill in the form, or paste a document, and it renders here.</p>;
  if (state.kind === "issues")
    return (
      <div className="error">
        <p><strong>{plural(state.issues.length, "thing")} to fix</strong></p>
        <ul>{state.issues.map((i, k) => <li key={k}><code>{i.path}</code> {i.message}</li>)}</ul>
      </div>
    );
  const { doc } = state;
  return (
    <>
      <div className="banner">Valid CoffeeJSON 1.0.</div>
      <CoffeeJSONView doc={doc} renderEmpty={() => <p className="muted">Fill in the form to see a preview.</p>} />
      <p><a className="btn" href={`/r/?d=${encodePayload(doc)}`}>Open in /r (brew-along preview)</a></p>
      <SaveCtaBlock doc={doc} />
    </>
  );
}

function renderPreview(): void {
  if (previewRoot) previewRoot.render(<Preview state={previewState()} />);
}

function refreshFeedback(): void {
  const cumsByRecipe = recipes.map((r) => r.steps.map((s) => num(s.cumulative)));
  const perPourByRecipe = cumsByRecipe.map((cums) => perPourAmounts(cums));
  app.querySelectorAll<HTMLElement>("[data-perpour]").forEach((el) => {
    const ri = Number(el.dataset["r"]); const i = Number(el.dataset["i"]);
    const v = perPourByRecipe[ri]?.[i];
    el.textContent = v !== undefined ? `+${v} g` : "";
  });
  recipes.forEach((_, ri) => {
    const guardEl = app.querySelector<HTMLElement>(`#guard-${ri}`);
    if (guardEl)
      guardEl.innerHTML = stepsNonDecreasing(cumsByRecipe[ri]!)
        ? "" : `<div class="error">Cumulative water targets must not decrease.</div>`;
  });
  renderPreview();
  syncJsonFromForm();
}

function renderAll(): void {
  previewRoot?.unmount();
  app.innerHTML = `${header}
    <h1>Generate a CoffeeJSON recipe</h1>
    <p class="muted">Type a recipe, and optionally the bean behind it. Nothing leaves your
    browser.</p>
    <div class="gen-layout">
      ${jsonPanelHtml()}
      <section class="card gen-preview" aria-label="Preview"><h2>Preview</h2><div id="preview"></div></section>
      <div id="formhost" class="gen-form">${formHtml()}</div>
    </div>`;
  previewRoot = createRoot(app.querySelector<HTMLElement>("#preview")!);
  wireJsonPanel();
  wireForm();
  refreshFeedback();
}

// A load driven by typing cannot go through renderAll(): it rebuilds the textarea,
// which is the element the caret is in.
function renderForm(): void {
  app.querySelector<HTMLElement>("#formhost")!.innerHTML = formHtml();
  wireForm();
  refreshFeedback();
}

// `touched` included: an empty form carrying six validation errors is an
// accusation, not feedback.
function replaceState(recipeForms: RecipeFormState[], nowTouched: boolean): void {
  Object.assign(bean, emptyBeanForm());
  recipes.splice(0, recipes.length, ...recipeForms);
  beanOpen = false;
  touched = nowTouched;
  jsonNotice = "";
  renderAll();
}

function wireForm(): void {
  app.querySelector("#clearform")!.addEventListener("click", () => replaceState([blankRecipe()], false));
  app.querySelector("#loadsample")!.addEventListener("click", () => replaceState(sampleRecipes(), true));

  app.querySelector<HTMLDetailsElement>("#beanpanel")!.addEventListener("toggle", (e) => {
    beanOpen = (e.currentTarget as HTMLDetailsElement).open; // bookkeeping only — no re-render
  });
  app.querySelectorAll<HTMLInputElement>("[data-bk]").forEach((el) =>
    el.addEventListener("input", () => {
      (bean as unknown as Record<string, unknown>)[el.dataset["bk"]!] = el.value;
      refreshFeedback();
    }));
  app.querySelectorAll<HTMLInputElement>("[data-ok]").forEach((el) =>
    el.addEventListener("input", () => {
      const i = Number(el.dataset["i"]);
      (bean.origin[i]! as unknown as Record<string, string>)[el.dataset["ok"]!] = el.value;
      refreshFeedback();
    }));
  app.querySelector("#addorigin")!.addEventListener("click", () => { bean.origin.push(emptyOriginItemForm()); renderAll(); });
  app.querySelectorAll<HTMLButtonElement>("[data-delorigin]").forEach((b) =>
    b.addEventListener("click", () => { bean.origin.splice(Number(b.dataset["delorigin"]), 1); renderAll(); }));

  app.querySelectorAll<HTMLInputElement>("[data-rk]:not([data-rk='method'])").forEach((el) =>
    el.addEventListener("input", () => {
      const ri = Number(el.dataset["r"]);
      (recipes[ri]! as unknown as Record<string, unknown>)[el.dataset["rk"]!] = el.value;
      refreshFeedback(); // inputs stay in the DOM → focus/cursor preserved
    }));
  app.querySelectorAll<HTMLSelectElement>("[data-rk='method']").forEach((el) =>
    el.addEventListener("change", () => {
      recipes[Number(el.dataset["r"])]!.method = el.value;
      renderAll(); // fields swap → full re-render
    }));
  app.querySelectorAll<HTMLInputElement>("[data-rcheck]").forEach((el) =>
    el.addEventListener("change", () => {
      recipes[Number(el.dataset["rcheck"])]!.recommended = el.checked;
      refreshFeedback();
    }));
  app.querySelectorAll<HTMLInputElement>("[data-sk]").forEach((el) =>
    el.addEventListener("input", () => {
      const ri = Number(el.dataset["r"]); const i = Number(el.dataset["i"]);
      (recipes[ri]!.steps[i]! as unknown as Record<string, string>)[el.dataset["sk"]!] = el.value;
      refreshFeedback();
    }));
  app.querySelectorAll<HTMLButtonElement>("[data-addstep]").forEach((b) =>
    b.addEventListener("click", () => { recipes[Number(b.dataset["addstep"])]!.steps.push(emptyStepForm()); renderAll(); }));
  app.querySelectorAll<HTMLButtonElement>("[data-delstep]").forEach((b) =>
    b.addEventListener("click", () => {
      recipes[Number(b.dataset["r"])]!.steps.splice(Number(b.dataset["i"]), 1);
      renderAll();
    }));
  app.querySelector("#addrecipe")!.addEventListener("click", () => {
    recipes.push(blankRecipe());
    renderAll();
  });
  app.querySelectorAll<HTMLButtonElement>("[data-delrecipe]").forEach((b) =>
    b.addEventListener("click", () => { recipes.splice(Number(b.dataset["delrecipe"]), 1); renderAll(); }));
}

renderAll();
