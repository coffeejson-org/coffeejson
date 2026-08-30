// The FAQ, in one place, because it is rendered twice: as prose on the landing
// page and as FAQPage JSON-LD in that page's static <head>. Google requires the
// two to say the same thing, and a hand-kept second copy is how they stop doing
// that — so both read this array and a test compares them.
//
// Each answer is written to stand alone. A reader arriving at the answer from a
// search result, or an assistant quoting one sentence of it, gets no help from
// the question above it or the section around it.

/** @type {{ q: string, a: string }[]} */
export const FAQ = [
  {
    q: "What is CoffeeJSON?",
    a: "CoffeeJSON is an open file format for coffee recipes and bean identity. One JSON document carries the dose, the water, the temperature, the grind and the timed pour schedule, together with the bean the coffee was made from — so an app can read a recipe another app wrote, instead of an importer written per vendor.",
  },
  {
    q: "Where can I use a CoffeeJSON document?",
    a: "Anywhere a file or a URL goes. A document moves between two apps, rides whole inside a share link, prints on a bag of coffee as a QR code, publishes on a web page as schema.org Recipe, and sits on your own disk as plain JSON. There is no server to call and no account to make.",
  },
  {
    q: "How do I add CoffeeJSON to my app?",
    a: "Validate documents against the published JSON Schema, then read them with a reference package or with your own code. Packages exist for TypeScript, React and Swift, and a document is plain JSON, so any language can read one. The integration guide carries the consumer and producer checklists.",
  },
  {
    q: "Is CoffeeJSON free to use?",
    a: "Yes. The specification, schema, fixtures and registries are CC0 — public domain, no attribution required and no conditions attached. The reference packages are Apache-2.0, patent grant included. There is nothing to sign up for and no organization to join: disagree with a decision and you can fork the format.",
  },
  {
    q: "Who is using CoffeeJSON today?",
    a: "One app on the App Store, and it is the author's own: BrewSmart, which has read and written the format since July 2026. More are wanted. If you build a coffee app, a roaster's site or a brewing service, get in touch — help writing the importer and exporter is yours for the asking, and so is a conversation about what the format gets wrong.",
  },
];

/** schema.org FAQPage, built from the same array the page renders. */
export const faqJsonLd = () => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://coffeejson.org/#faq",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});
