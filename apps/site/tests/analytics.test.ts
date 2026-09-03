import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pathOnly, posthogOptions, scrubUrls } from "../src/lib/analytics";
import { footerHtml, licenseLine, PRIVACY } from "../src/lib/footer.mjs";

const site = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(site, p), "utf8");

// The HTML entry points, discovered the way `vite.config.ts` discovers them:
// the hand-written shells one by one, the generated corpus and bean pages by
// reading the directories `pnpm gen` wrote. Hardcoding the list here would let
// a new page ship with no analytics and no failing test.
function entryPages(): string[] {
  const dirs = (d: string) =>
    readdirSync(join(site, d), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `${d}/${e.name}/index.html`);
  return [
    "index.html",
    "validator/index.html",
    "r/index.html",
    "recipes/index.html",
    "generate/index.html",
    "for-ai-agents/index.html",
    "implementations/index.html",
    "showcase/index.html",
    "beans/index.html",
    ...dirs("recipes"),
    ...dirs("beans"),
  ];
}

describe("the retracted claim", () => {
  // Checked against the built pages rather than the sources: most footers reach
  // the reader through generated HTML, where a source-only check misses them.
  it("appears in no built page", () => {
    for (const page of entryPages()) {
      expect(read(page), page).not.toContain("No analytics on this site");
    }
  });

  it("appears nowhere in the site's own sources either", () => {
    const roots = ["src/pages", "src/lib", "tools"];
    for (const root of roots) {
      for (const file of readdirSync(join(site, root))) {
        expect(read(`${root}/${file}`), `${root}/${file}`).not.toContain(
          "No analytics on this site",
        );
      }
    }
  });

  it("is replaced by a sentence with one source", () => {
    expect(footerHtml("License.")).toContain(PRIVACY);
    expect(licenseLine("License.")).toContain(PRIVACY);
    // Every page that prints a license footer prints the same privacy sentence,
    // because both builders append it rather than accepting it.
    for (const page of entryPages()) {
      const html = read(page);
      if (html.includes("CC0 1.0 Universal"))
        expect(html, page).toContain(PRIVACY);
    }
  });

  // A links-only footer is silent rather than false, but silent is not what the
  // other pages do. Every footer is built from `footer.mjs`, the only way to get
  // the sentence, so a page growing its own fails here.
  const emitters = [
    "tools/gen.mjs",
    ...["src/pages", "src/lib"].flatMap((d) =>
      readdirSync(join(site, d)).map((f) => `${d}/${f}`),
    ),
  ].filter((f) => /<footer|footerHtml\(/.test(read(f)));

  it("every module that emits a footer is accounted for", () => {
    expect(emitters.sort()).toEqual([
      "src/lib/beans-body.ts",
      "src/lib/footer.d.mts",
      "src/lib/footer.mjs",
      "src/pages/for-ai-agents.ts",
      "src/pages/implementations.ts",
      "src/pages/landing.ts",
      "src/pages/showcase.ts",
      "tools/gen.mjs",
    ]);
  });

  it.each(emitters)("%s builds its footer from the shared source", (file) => {
    expect(read(file)).toMatch(/\b(footerHtml|licenseLine)\(/);
  });
});

describe("analytics coverage", () => {
  it("every entry page loads the analytics module", () => {
    const pages = entryPages();
    expect(pages.length).toBeGreaterThan(9);
    for (const page of pages) {
      expect(read(page), page).toContain('src="/src/lib/analytics.ts"');
    }
  });
});

describe("the crawler posture", () => {
  // Analytics being on does not change who may fetch the site, and the
  // AI-agents page says so in as many words — so the robots file has to mean
  // what that page claims.
  const robots = read("public/robots.txt");

  it("still asks the named training crawlers away", () => {
    for (const bot of [
      "GPTBot",
      "CCBot",
      "Bytespider",
      "Amazonbot",
      "Applebot-Extended",
      "meta-externalagent",
    ]) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
  });

  it("still welcomes search and retrieval", () => {
    for (const bot of [
      "ClaudeBot",
      "Google-Extended",
      "OAI-SearchBot",
      "ChatGPT-User",
      "PerplexityBot",
    ]) {
      expect(robots).not.toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain(
      "Content-Signal: search=yes,ai-input=yes,ai-train=no",
    );
  });

  it("names no analytics host — ingestion is not a crawl", () => {
    expect(robots).not.toContain("posthog");
  });
});

describe("the recipe payload never leaves the browser", () => {
  const SHARE = "https://coffeejson.org/r/?d=eyJjb2ZmZWVqc29uIjoiMS4wIn0";

  it("the URL PostHog is given carries no query string", () => {
    expect(posthogOptions.get_current_url(SHARE)).toBe(
      "https://coffeejson.org/r/",
    );
    expect(posthogOptions.get_current_url(SHARE)).not.toContain("?");
  });

  it("strips the query and the fragment from an address", () => {
    expect(pathOnly(SHARE)).toBe("https://coffeejson.org/r/");
    expect(pathOnly("https://coffeejson.org/generate/#bean")).toBe(
      "https://coffeejson.org/generate/",
    );
    expect(pathOnly("/r/?d=eyJ")).toBe("/r/");
  });

  it("leaves a non-address alone", () => {
    expect(pathOnly("$direct")).toBe("$direct");
  });

  it("scrubs every property a payload could ride in on", () => {
    const props = scrubUrls({
      $current_url: SHARE,
      $initial_current_url: SHARE,
      $session_entry_url: SHARE,
      $referrer: SHARE,
      $initial_referrer: SHARE,
      $external_click_url: SHARE,
      $pathname: "/r/?d=eyJ",
      $browser: "Firefox",
    });
    for (const [key, value] of Object.entries(props)) {
      if (key !== "$browser") expect(String(value), key).not.toContain("d=eyJ");
    }
    expect(props.$browser).toBe("Firefox");
  });

  it("what before_send hands back has been scrubbed", () => {
    const event = {
      uuid: "0",
      event: "$pageview",
      properties: { $current_url: SHARE, $referrer: SHARE },
    };
    const sent = posthogOptions.before_send(event);
    expect(JSON.stringify(sent)).not.toContain("d=eyJ");
    expect(sent?.properties?.$current_url).toBe("https://coffeejson.org/r/");
  });
});

describe("the config the privacy sentence rests on", () => {
  // Each is a clause of that sentence, so turning one off has to change
  // `footer.mjs` too — a decision rather than an oversight.
  it("sets no cookie and no browser storage", () => {
    expect(posthogOptions.cookieless_mode).toBe("always");
  });

  it("never builds a person profile", () => {
    expect(posthogOptions.person_profiles).toBe("never");
  });

  it("captures nothing but page views, and loads nothing third-party", () => {
    expect(posthogOptions.autocapture).toBe(false);
    expect(posthogOptions.disable_session_recording).toBe(true);
    expect(posthogOptions.disable_surveys).toBe(true);
    expect(posthogOptions.disable_external_dependency_loading).toBe(true);
    expect(posthogOptions.advanced_disable_flags).toBe(true);
    expect(posthogOptions.respect_dnt).toBe(true);
  });

  it("pins its defaults to a date, so a release cannot move them", () => {
    expect(posthogOptions.defaults).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
