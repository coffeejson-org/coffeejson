import { associatedMember } from "./association.js";
import { fmtMeasurement, gearLabel } from "./format.js";
import {
  arr,
  calendarDay,
  isObj,
  measurement,
  num,
  objItems,
  partyName,
  str,
  strArr,
} from "./json.js";

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

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name,
  };
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
function ingredientStrings(
  doc: Record<string, unknown>,
  r: Record<string, unknown>,
): string[] {
  const out: string[] = [];
  const coffee = fmtMeasurement(measurement(r["coffee"]));
  if (coffee) {
    const bean = associatedMember(
      objItems(doc["beans"]),
      str(r["bean_ref"]),
      (b) => str(b["id"]),
    );
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
  const text =
    str(s["instruction"])?.trim() || (target ? `Pour to ${target}` : "");
  if (!text) return null;
  const node: Record<string, unknown> = { "@type": "HowToStep", text };
  const label = str(s["label"]);
  if (label) node["name"] = label;
  return node;
}

/**
 * CoffeeJSON bean → schema.org `Product` JSON-LD, for `<script type="application/ld+json">`.
 * A bean is a coffee a roaster sells, and `Product` is the type that says so —
 * but the node carries **no `offers`**: price, stock and lot size live in the
 * roaster's own listing (principle 4), which `sameAs` points at. The identity
 * rides as `additionalProperty` under the CoffeeJSON member names with the
 * wire values verbatim, so a reader that knows the format reads it back.
 * Absent data stays absent, and `id` / `lang` / `localizations` never export.
 * A lot member the node cannot attribute to a named component never exports
 * either, except where the bag itself is the only component.
 */
export function beanJsonLd(
  doc: unknown,
  beanIndex: number,
  options?: {
    /**
     * The page's canonical URL — page knowledge, not document data. Pass it only
     * where this bean is the page's subject: two nodes from one page must not
     * both claim the same address. For a page listing several bags, omit it and
     * let each bag's own `sameAs` carry its listing.
     */
    url?: string;
  },
): Record<string, unknown> | null {
  if (!isObj(doc)) return null;
  // Indexed against the RAW array, as `recipeJsonLd` is, for the same reason.
  const b = arr(doc["beans"])[beanIndex];
  if (!isObj(b)) return null;
  const name = str(b["name"])?.trim();
  if (!name) return null;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
  };
  if (options?.url) ld["url"] = options.url;
  // The roaster's listing is where the offer lives. When the page IS the listing
  // (the roaster embedding this on their own product page), `url` already says so.
  const listing = str(b["url"]);
  if (listing && listing !== options?.url) ld["sameAs"] = listing;
  const description = str(b["description"]);
  if (description) ld["description"] = description;
  const images = strArr(b["images"]);
  if (images.length) ld["image"] = images;
  const brand = roasterNode(b["roaster"]);
  if (brand) ld["brand"] = brand;

  const items = isObj(b["origin"]) ? objItems(b["origin"]["items"]) : [];
  const countries = [
    ...new Set(
      items.map((it) => str(it["country"])).filter((c): c is string => !!c),
    ),
  ];
  // The code rides as `identifier`, never as `name`: an alpha-2 code is not what
  // the country is called, the format carries no display name for one, and
  // inventing "Colombia" would fabricate a string in a language the document
  // never chose. A consumer that wants a name maps the code itself.
  const countryNode = (c: string) => ({ "@type": "Country", identifier: c });
  if (countries.length === 1)
    ld["countryOfOrigin"] = countryNode(countries[0]!);
  else if (countries.length > 1)
    ld["countryOfOrigin"] = countries.map(countryNode);

  const roastDate = calendarDay(b["roast_date"]);
  if (roastDate) ld["productionDate"] = roastDate;

  const props: Record<string, unknown>[] = [];
  const prop = (name: string, value: unknown) =>
    props.push({ "@type": "PropertyValue", name, value });
  // Lot-level facts export only when there is exactly one lot to attribute them
  // to. A blend's per-component region or altitude belongs to a component the
  // node cannot name, so a blend exports its countries and nothing finer.
  if (items.length === 1) {
    const lot = items[0]!;
    const region = str(lot["region"]);
    if (region) prop("region", region);
    for (const p of objItems(lot["producers"])) {
      const producer = partyName(p);
      if (producer) prop("producer", producer);
    }
    const altitude = altitudeNode(lot["altitude"]);
    if (altitude) props.push(altitude);
    const harvest = str(lot["harvest_time"]);
    if (harvest) prop("harvest_time", harvest);
  }
  const set = (key: string) => {
    const values = strArr(b[key]);
    if (values.length) prop(key, values);
  };
  // A member the bag does not state may still be stated by its lots. One lot IS
  // the bag, so both members fall back to it. Across several, only `process`
  // unions: `processList` says that a multi-process list stated at bag level
  // means the bag contains coffee of each, so the union is a reading the format
  // already sanctions. No such reading exists for `varietals`, and every lot's
  // varieties flattened into one list describes no coffee in the bag.
  const fromLots = (key: string): string[] => {
    const stated = strArr(b[key]);
    if (stated.length) return stated;
    if (items.length === 1) return strArr(items[0]![key]);
    return key === "process"
      ? [...new Set(items.flatMap((it) => strArr(it[key])))]
      : [];
  };
  const setFromLots = (key: string) => {
    const values = fromLots(key);
    if (values.length) prop(key, values);
  };
  const text = (key: string) => {
    const value = str(b[key]);
    if (value) prop(key, value);
  };
  setFromLots("process");
  text("drying_method");
  setFromLots("varietals");
  text("roast_level");
  const agtron = num(b["roast_agtron"]);
  if (agtron !== null) prop("roast_agtron", agtron);
  const rest = restDaysNode(b["rest_days"]);
  if (rest) props.push(rest);
  text("production_roaster");
  if (typeof b["decaf"] === "boolean") prop("decaf", b["decaf"]);
  text("form");
  text("preferred_extraction");
  set("certifications");
  set("roaster_notes");
  if (props.length) ld["additionalProperty"] = props;

  return ld;
}

/** The roaster as a brand node; absent `type` reads as Organization by role. */
function roasterNode(v: unknown): Record<string, unknown> | undefined {
  const name = partyName(v);
  if (!name || !isObj(v)) return undefined;
  const node: Record<string, unknown> = {
    "@type": str(v["type"]) === "person" ? "Person" : "Organization",
    name,
  };
  const url = str(v["url"]);
  if (url) node["url"] = url;
  return node;
}

// UN/CEFACT Recommendation 20 codes for the two length units the format defines.
const LENGTH_UNIT_CODE: Record<string, string> = { meter: "MTR", foot: "FOT" };

function altitudeNode(v: unknown): Record<string, unknown> | null {
  if (!isObj(v)) return null;
  const unitCode = LENGTH_UNIT_CODE[str(v["unit"]) ?? ""];
  if (!unitCode) return null;
  const node: Record<string, unknown> = {
    "@type": "PropertyValue",
    name: "altitude",
  };
  const value = num(v["value"]);
  const min = num(v["min"]);
  const max = num(v["max"]);
  if (value !== null) node["value"] = value;
  else if (min !== null || max !== null) {
    if (min !== null) node["minValue"] = min;
    if (max !== null) node["maxValue"] = max;
  } else return null;
  node["unitCode"] = unitCode;
  return node;
}

function restDaysNode(v: unknown): Record<string, unknown> | null {
  if (!isObj(v)) return null;
  const min = num(v["min"]);
  const max = num(v["max"]);
  if (min === null && max === null) return null;
  const node: Record<string, unknown> = {
    "@type": "PropertyValue",
    name: "rest_days",
  };
  if (min !== null) node["minValue"] = min;
  if (max !== null) node["maxValue"] = max;
  node["unitText"] = "day";
  return node;
}
