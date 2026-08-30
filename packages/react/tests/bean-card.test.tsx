import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { normalize } from "@coffeejson/core";
import { BeanCard } from "../src/BeanCard";

const beanOf = (b: object) =>
  normalize({ coffeejson: "1.0", beans: [b] }).beans[0]!;

test("full bean renders name, linked roaster, origin, process, varietals, roast, notes", () => {
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Las Brisas", roaster: "Onyx", url: "https://example.com/beans",
    origin: { items: [{ name: "Finca X", country: "CO", region: "Huila", process: ["washed"], percentage: 100 }] },
    process: ["washed"], drying_method: "Patio",
    varietals: ["Caturra", "Bourbon"],
    roast_level: "light_medium", roast_agtron: 60, roast_date: "2026-01-01",
    roaster_notes: ["Floral", "Citrus"], description: "A lovely coffee.",
  })} />);
  expect(html).toContain('<article class="cj-card cj-bean-card"');
  expect(html).toContain("Las Brisas");
  expect(html).toContain('href="https://example.com/beans"');
  expect(html).toContain("Finca X · Huila, Colombia · Washed · 100%");
  expect(html).toContain("Washed · Patio");
  expect(html).toContain("Caturra, Bourbon");
  expect(html).toContain("Light-medium · Agtron 60 · 2026-01-01");
  expect(html).toContain("Floral, Citrus");
  expect(html).toContain("A lovely coffee.");
});

test("a vocabulary token renders as its label, never as the wire value", () => {
  // `drying_method` is the one value on these rows the spec calls free text, so it
  // passes through exactly as the roaster wrote it.
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Tokens", roaster: "R",
    origin: { items: [{ country: "ET", process: ["carbonic_maceration"] }] },
    process: ["pulped_natural"], drying_method: "raised_bed", roast_level: "medium_dark",
  })} />);
  expect(html).toContain("Pulped natural · raised_bed");
  expect(html).toContain("Carbonic maceration");
  expect(html).toContain("Medium-dark");
  expect(html).not.toContain("pulped_natural");
  expect(html).not.toContain("medium_dark");
});

test("a coffee that states two processes shows both", () => {
  // `process` is a set on the wire, and one value cannot carry "Double Anaerobic
  // Honey" — a card that read only the first would drop half the claim.
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Double", roaster: "R", process: ["anaerobic", "honey"],
  })} />);
  expect(html).toContain("Anaerobic · Honey");
});

test("an unrecognized process reads as Other; an unrecognized roast level drops out", () => {
  // The spec's two fallbacks: `process` names `other`, so a token this build
  // does not know lands there. `roast_level` names none — it is ignored in
  // favor of `roast_agtron` — so the row keeps only what it can state.
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Future", roaster: "R", process: ["koji"], roast_level: "charcoal", roast_agtron: 45,
  })} />);
  expect(html).toContain(">Other<");
  expect(html).not.toContain("koji");
  expect(html).toContain(">Agtron 45<");
  expect(html).not.toContain("charcoal");
});

test("a region without a country renders alone, with no orphaned separator", () => {
  // A roaster may state a region broader than any country ("East Africa") and name
  // no country: the two are independently optional, and the ", " joining them must
  // not dangle.
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Continental", roaster: "R",
    origin: { type: "blend", items: [
      { country: "CO", region: "Huila", process: ["washed"] },
      { region: "East Africa", process: ["natural"] },
    ] },
  })} />);
  expect(html).toContain("Huila, Colombia · Washed");
  expect(html).toContain("East Africa · Natural");
  expect(html).not.toContain("East Africa, ");
  expect(html).not.toContain(", ·");
});

test("the roaster line links the roaster's own page, and the bag's otherwise", () => {
  const card = (roaster: object) => renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Las Brisas", url: "https://example.com/beans", roaster,
  })} />);
  expect(card({ name: "Onyx", url: "https://onyx.example" }))
    .toContain('href="https://onyx.example"');
  expect(card({ name: "Onyx", url: "https://onyx.example" }))
    .not.toContain("https://example.com/beans");
  expect(card({ name: "Onyx" })).toContain('href="https://example.com/beans"');
  // An unusable roaster link is no link at all, so the bag's stands in for it.
  expect(card({ name: "Onyx", url: "javascript:alert(1)" }))
    .toContain('href="https://example.com/beans"');
});

test("name falls back to Coffee; unsafe url renders no anchor", () => {
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({ roaster: "R", url: "javascript:alert(1)" })} />);
  expect(html).toContain(">Coffee</h3>");
  expect(html).not.toContain("href=");
  expect(html).toContain("R");
});

test("empty-string name falls back to Coffee", () => {
  expect(renderToStaticMarkup(<BeanCard bean={beanOf({ name: "", roaster: "R" })} />)).toContain(">Coffee</h3>");
});

test("an origin line states its producers, altitude, varietals and harvest", () => {
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Blend", roaster: "R",
    origin: { items: [{
      name: "Finca X", country: "CO", region: "Huila",
      producers: [{ name: "Elias Roa", role: "farm" }, { name: "Coop Huila" }],
      altitude: { min: 1700, max: 1900, unit: "meter" },
      varietals: ["Caturra", "Bourbon"],
      process: ["washed"], harvest_time: "Oct–Dec 2024", percentage: 60,
    }] },
  })} />);
  expect(html).toContain(
    "Finca X · Huila, Colombia · Elias Roa (Farm), Coop Huila · 1700–1900 m · "
    + "Varietals Caturra, Bourbon · Washed · Harvest Oct–Dec 2024 · 60%",
  );
});

test("an unrecognized producer role is shown beside the name, never dropped with it", () => {
  const html = renderToStaticMarkup(<BeanCard bean={beanOf({
    name: "Roles", roaster: "R",
    origin: { items: [{ producers: [{ name: "Someone", role: "cup-taster" }] }] },
  })} />);
  expect(html).toContain("Someone (cup-taster)");
});
