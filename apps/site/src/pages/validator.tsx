import type { CoffeeJSONDocument } from "@coffeejson/core";
import { FORMAT_VERSION } from "@coffeejson/core";
import { CoffeeJSONView } from "@coffeejson/react";
import { createRoot } from "react-dom/client";
import "@coffeejson/react/styles.css";
import { documentFromInput } from "../lib/input-document";
import { siteHeader } from "../lib/site-header.mjs";
import { plural } from "../lib/text.mjs";
import type { ValidationIssue } from "../lib/validate";
import { lintDocument, validateDocument } from "../lib/validate";

const app = document.querySelector<HTMLElement>("#app")!;
app.innerHTML = `
  ${siteHeader("/validator/")}
  <h1>Validator</h1>
  <p class="muted">Paste a CoffeeJSON document, a share URL (<code>…/r?d=…</code>), or upload a
  <code>.json</code> file. Validation runs entirely in your browser against the
  <a href="/schema/1.0">v1.0 JSON Schema</a>, then lints whatever passes against the stricter
  <a href="/schema/authoring/1.0">authoring schema</a> — nothing is uploaded anywhere.</p>
  <p><label class="btn btn--ghost">Upload file<input type="file" id="file" class="visually-hidden" accept=".json,application/json"></label></p>
  <textarea id="input" class="field" placeholder='{"coffeejson": "${FORMAT_VERSION}", …}  or  https://coffeejson.org/r?d=…'></textarea>
  <p><button class="btn" id="check">Validate</button></p>
  <div id="result"></div>`;

const input = document.querySelector<HTMLTextAreaElement>("#input")!;

type Outcome =
  | { kind: "error"; message: string }
  | { kind: "issues"; issues: ValidationIssue[] }
  | { kind: "valid"; doc: CoffeeJSONDocument; lint: ValidationIssue[] };

function ValidationResult({ outcome }: { outcome: Outcome | null }) {
  if (outcome === null) return null;
  if (outcome.kind === "error")
    return <div className="error">{outcome.message}</div>;
  if (outcome.kind === "issues")
    return (
      <div className="error">
        <p>
          <strong>{plural(outcome.issues.length, "problem")}</strong>
        </p>
        <ul>
          {outcome.issues.map((i, k) => (
            <li key={k}>
              <code>{i.path}</code> {i.message}
            </li>
          ))}
        </ul>
      </div>
    );
  const d = outcome.doc;
  return (
    <>
      <div className="banner">
        Valid CoffeeJSON {d.coffeejson} —{" "}
        {plural(d.recipes?.length ?? 0, "recipe")},{" "}
        {plural(d.beans?.length ?? 0, "bean")}.
      </div>
      {outcome.lint.length > 0 && (
        <div className="notes">
          <p>
            <strong>{plural(outcome.lint.length, "authoring note")}.</strong>{" "}
            The document is valid and every consumer must ignore what these
            name. They are what the stricter{" "}
            <a href="/schema/authoring/1.0">authoring schema</a> catches for
            whoever produced it, most often a typo'd member that would otherwise
            be dropped in silence.
          </p>
          <ul>
            {outcome.lint.map((i, k) => (
              <li key={k}>
                <code>{i.path}</code> {i.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <CoffeeJSONView doc={d} />
    </>
  );
}

const resultRoot = createRoot(document.querySelector<HTMLElement>("#result")!);
function run(): void {
  const { doc, error } = documentFromInput(
    input.value,
    "Nothing to validate yet.",
  );
  if (error) {
    resultRoot.render(
      <ValidationResult outcome={{ kind: "error", message: error }} />,
    );
    return;
  }
  const issues = validateDocument(doc);
  if (issues.length) {
    resultRoot.render(
      <ValidationResult outcome={{ kind: "issues", issues }} />,
    );
    return;
  }
  resultRoot.render(
    <ValidationResult
      outcome={{
        kind: "valid",
        doc: doc as CoffeeJSONDocument,
        lint: lintDocument(doc),
      }}
    />,
  );
}

const check = document.querySelector<HTMLButtonElement>("#check")!;
check.addEventListener("click", run);
document
  .querySelector<HTMLInputElement>("#file")!
  .addEventListener("change", async (e) => {
    const f = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!f) return;
    // Reading the file is async, and Validate pressed in between would run against
    // the previous textarea contents.
    check.disabled = true;
    check.setAttribute("aria-busy", "true");
    try {
      input.value = await f.text();
    } finally {
      check.disabled = false;
      check.removeAttribute("aria-busy");
    }
    run();
  });
