import { decodePayload, encodePayload } from "@coffeejson/core";
import { embedSnippet, jsonLdByDefault } from "./embed-snippet";

// The picker on `/embed/`. The build wrote the page whole, with the default
// document in the card and the snippet; this only swaps the document. It never
// imports the element: the card is drawn by the CDN script, or the CDN check
// tests nothing.

const YOURS = "yours";

type Documents = { slug: string; payload: string }[];
const loadDocuments = async (): Promise<Documents> =>
  (await import("../generated/embed-documents.json")).default;

export function wireEmbedPage(
  root: ParentNode,
  search: string,
  documents: () => Promise<Documents> = loadDocuments,
): void {
  const pick = root.querySelector<HTMLSelectElement>("[data-embed-pick]");
  const card = root.querySelector<HTMLElement>("#embed-card");
  const code = root.querySelector<HTMLElement>("[data-embed-snippet]");
  const jsonld = root.querySelector<HTMLInputElement>("[data-embed-jsonld]");
  const error = root.querySelector<HTMLElement>("[data-embed-error]");
  const version = root
    .querySelector<HTMLElement>("[data-embed-version]")
    ?.getAttribute("data-embed-version");
  if (!pick || !card || !code || !jsonld || !error || !version) return;

  const first = decodePayload(card.getAttribute("d") ?? "");
  let doc: unknown = first.ok ? first.document : null;
  // The visitor's own document from `?d=`, kept so picking it again restores it.
  let mine: unknown = null;
  const render = () => {
    if (doc === null) return;
    card.setAttribute("d", encodePayload(doc));
    code.textContent = embedSnippet(doc, { version, jsonld: jsonld.checked });
  };
  const show = (next: unknown) => {
    doc = next;
    jsonld.checked = jsonLdByDefault(next);
    render();
  };

  pick.addEventListener("change", async () => {
    error.hidden = true;
    if (pick.value === YOURS) {
      if (mine !== null) show(mine);
      return;
    }
    const found = (await documents()).find((d) => d.slug === pick.value);
    const decoded = found ? decodePayload(found.payload) : null;
    if (decoded?.ok) show(decoded.document);
  });
  jsonld.addEventListener("change", render);

  // `?d=` is a document from /generate. It stays in this tab: nothing sends it.
  const d = new URLSearchParams(search).get("d");
  if (d) {
    const decoded = decodePayload(d);
    if (decoded.ok) {
      const option = document.createElement("option");
      option.value = YOURS;
      option.textContent = "Your document";
      pick.prepend(option);
      pick.value = YOURS;
      mine = decoded.document;
      show(mine);
    } else {
      error.textContent = `This link's document could not be read: ${decoded.error.kind}.`;
      error.hidden = false;
    }
  }
}

if (
  typeof document !== "undefined" &&
  document.querySelector("[data-embed-pick]")
)
  wireEmbedPage(document, location.search);
