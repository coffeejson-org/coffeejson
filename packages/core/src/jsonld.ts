import { fmtMeasurement, gearLabel } from "./format.js";
import { associatedMember } from "./association.js";
import { arr, calendarDay, isObj, measurement, num, objItems, partyName, str, strArr } from "./json.js";

/**
 * CoffeeJSON → schema.org `Recipe` JSON-LD, for `<script type="application/ld+json">`.
 * `Recipe` is a `HowTo` subtype, which legitimizes `tool` and `performTime`.
 * Absent data stays absent — nothing is fabricated for a search feature, and
 * document mechanics (`generator`, `bean_ref`, `recommended`) never export.
 */
export function recipeJsonLd(
  doc: unknown,
  recipeIndex: number,
  options?: {
    /** The page's canonical URL — page knowledge, not document data. */
    url?: string;
  },
): Record<string, unknown> | null {
  if (!isObj(doc)) return null;
  // Indexed against the RAW array: `recipeIndex` addresses a position in the
  // caller's own document, so filtering unreadable entries would shift it.
  const r = arr(doc["recipes"])[recipeIndex];
  if (!isObj(r)) return null;
  const name = str(r["title"])?.trim();
  if (!name) return null;

  const ld: Record<string, unknown> = { "@context": "https://schema.org", "@type": "Recipe", name };
  if (options?.url) ld["url"] = options.url;
  const description = str(r["description"]);
  if (description) ld["description"] = description;
  const images = strArr(r["images"]);
  if (images.length) ld["image"] = images;
  const author = partyNode(r["author"]);
  if (author) ld["author"] = author;
  const basedOn = str(r["based_on"]);
  if (basedOn) ld["isBasedOn"] = basedOn;
  const datePublished = calendarDay(r["date_published"]);
  if (datePublished) ld["datePublished"] = datePublished;
  const lang = str(r["lang"]);
  if (lang) ld["inLanguage"] = lang;
  const finishS = num(r["finish_s"]);
  if (finishS !== null) ld["performTime"] = `PT${finishS}S`;
  const recipeYield = fmtMeasurement(measurement(r["yield"]));
  if (recipeYield) ld["recipeYield"] = recipeYield;

  const ingredients = ingredientStrings(doc, r);
  if (ingredients.length) ld["recipeIngredient"] = ingredients;

  const instructions = objItems(r["steps"])
    .map(stepNode)
    .filter((s): s is Record<string, unknown> => s !== null);
  if (instructions.length) ld["recipeInstructions"] = instructions;

  const grind = isObj(r["grind"]) ? r["grind"] : null;
  const tool = [r["brewer"], r["basket"], grind ? grind["grinder"] : undefined]
    // Arrow, not a bare reference: gearLabel takes an optional label map as its
    // second argument and Array.map would hand it the index.
    .map((g) => gearLabel(g))
    .filter(Boolean)
    .map((toolName) => ({ "@type": "HowToTool", name: toolName }));
  if (tool.length) ld["tool"] = tool;

  return ld;
}

/** A schema.org Person/Organization node; no usable name means no node. */
function partyNode(v: unknown): Record<string, unknown> | undefined {
  const name = partyName(v);
  if (!name || !isObj(v)) return undefined;
  // Absent/unknown `type` falls back by role: a recipe author reads as a person.
  const node: Record<string, unknown> = {
    "@type": str(v["type"]) === "organization" ? "Organization" : "Person",
    name,
  };
  const url = str(v["url"]);
  if (url) node["url"] = url;
  return node;
}

// `recipeIngredient` strings — e.g. `"15 g coffee — Nano Challa (Example
// Roastery)"`, `"250 g water"`, `"100 g milk (oat)"`.
function ingredientStrings(doc: Record<string, unknown>, r: Record<string, unknown>): string[] {
  const out: string[] = [];
  const coffee = fmtMeasurement(measurement(r["coffee"]));
  if (coffee) {
    const bean = associatedMember(objItems(doc["beans"]), str(r["bean_ref"]), (b) => str(b["id"]));
    const beanName = bean === null ? null : str(bean["name"])?.trim();
    const roaster = bean === null ? null : partyName(bean["roaster"]);
    out.push(
      beanName
        ? `${coffee} coffee — ${beanName}${roaster ? ` (${roaster})` : ""}`
        : `${coffee} coffee`,
    );
  }
  const water = fmtMeasurement(measurement(r["water"]));
  if (water) out.push(`${water} water`);
  for (const a of objItems(r["additions"])) {
    const type = str(a["type"]);
    if (!type) continue;
    // `ice` with no amount still marks the recipe iced, so an unquantified
    // addition exports as its type alone.
    const amount = fmtMeasurement(measurement(a["amount"]));
    const noteText = str(a["note"]);
    const note = noteText ? ` (${noteText})` : "";
    out.push(amount ? `${amount} ${type}${note}` : `${type}${note}`);
  }
  return out;
}

// The `instruction`, else the pour-target derivation ("Pour to 250 g"); a step
// with neither is skipped, never padded. Derived labels serialize as absent, so
// any `label` present is the author's and rides as the step `name`.
function stepNode(s: Record<string, unknown>): Record<string, unknown> | null {
  const target = fmtMeasurement(measurement(s["to_water"]));
  const text = str(s["instruction"])?.trim() || (target ? `Pour to ${target}` : "");
  if (!text) return null;
  const node: Record<string, unknown> = { "@type": "HowToStep", text };
  const label = str(s["label"]);
  if (label) node["name"] = label;
  return node;
}
