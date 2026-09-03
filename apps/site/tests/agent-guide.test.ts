import { describe, expect, it } from "vitest";
import {
  EXAMPLES,
  PITFALLS,
  SYSTEM_PROMPT,
} from "../src/lib/agent-examples.mjs";
import {
  guideHeadings,
  guideHrefs,
  guideHtml,
  guideMarkdown,
} from "../src/lib/agent-guide.mjs";
import {
  CRAWLERS_UNCHANGED,
  LICENSE_CORPUS,
  PRIVACY,
} from "../src/lib/footer.mjs";
import { esc } from "../src/lib/text.mjs";
import { buildAgentsMd, SITE_URL } from "../tools/gen.mjs";

const html = guideHtml();
const md = guideMarkdown(SITE_URL);
const agentsMd = buildAgentsMd();

// `/agents/` and `/agents.md` are the same guide twice. The guide is authored
// once, in `agent-guide.mjs`, precisely so they cannot disagree — this file is
// what makes that true rather than merely intended. A section, a link, an
// example or a pitfall that reaches one surface and not the other is the bug.
describe("the two agent surfaces render one guide", () => {
  it("gives both the same sections, in the same order", () => {
    const headings = guideHeadings();
    expect(headings.length).toBeGreaterThan(0);
    const inHtml = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
    const inMd = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(inHtml).toEqual(headings.map(esc));
    expect(inMd).toEqual(headings);
  });

  // The one deliberate difference: a relative href resolves nowhere in a file
  // an agent fetched on its own, so markdown carries the canonical host.
  it("points both at the same targets, absolute only in markdown", () => {
    const hrefs = guideHrefs();
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(html, href).toContain(`href="${esc(href)}"`);
      const target = href.startsWith("/") ? `${SITE_URL}${href}` : href;
      expect(md, href).toContain(`](${target})`);
    }
  });

  it("teaches both the same system prompt", () => {
    expect(html).toContain(esc(SYSTEM_PROMPT));
    expect(md).toContain(SYSTEM_PROMPT);
  });

  it("teaches both every example, document included", () => {
    for (const e of EXAMPLES) {
      expect(html, e.prompt).toContain(esc(e.prompt));
      expect(html, e.prompt).toContain(esc(e.note));
      expect(html, e.prompt).toContain(esc(JSON.stringify(e.doc, null, 2)));
      expect(md, e.prompt).toContain(`### ${e.prompt}`);
      expect(md, e.prompt).toContain(e.note);
      expect(md, e.prompt).toContain(JSON.stringify(e.doc, null, 2));
    }
  });

  it("warns both about every pitfall", () => {
    for (const p of PITFALLS) {
      for (const field of [p.wrong, p.right, p.why]) {
        expect(html, p.wrong).toContain(esc(field));
        expect(md, p.wrong).toContain(field);
      }
    }
    // A table row per pitfall, plus the header and the separator.
    expect(md.split("\n").filter((l) => l.startsWith("| ")).length).toBe(
      PITFALLS.length + 2,
    );
  });
});

describe("/agents.md is this site, described for an agent", () => {
  it("opens the way the convention does — a title, then what it is for", () => {
    const lines = agentsMd.split("\n");
    expect(lines[0]).toBe("# Agent Instructions — CoffeeJSON");
    expect(lines[2]).toContain("how AI agents can work with CoffeeJSON");
  });

  // The line that makes the file self-locating for an agent that arrived at it
  // from a guess rather than a link.
  it("names itself as the canonical agent-facing description", () => {
    expect(agentsMd).toContain("`/agents.md`");
    expect(agentsMd).toContain(
      "canonical agent-facing description of this site",
    );
    expect(agentsMd).toContain(`${SITE_URL}/agents/`);
  });

  it("inlines the guide rather than linking to it", () => {
    expect(agentsMd).toContain(md);
    for (const p of PITFALLS) expect(agentsMd).toContain(p.wrong);
    expect(agentsMd).toContain(SYSTEM_PROMPT);
  });

  // Every surface it advertises has to be one the build actually writes; a
  // description that sends an agent to a 404 is worse than no description.
  it("advertises only surfaces on the canonical host", () => {
    const gets = [...agentsMd.matchAll(/`GET ([^`]+)`/g)].map(
      (m) => m[1] ?? "",
    );
    expect(gets.length).toBeGreaterThan(8);
    for (const url of gets) expect(url.startsWith(SITE_URL), url).toBe(true);
  });

  it("says plainly that there is nothing to call", () => {
    expect(agentsMd).toContain("No account, no key, no endpoint to call");
  });

  it("is markdown, not markup", () => {
    expect(agentsMd).not.toMatch(
      /<\/?(p|h[1-6]|a|code|pre|table|strong|em|ol|li)\b/,
    );
  });

  // The page gets these from the shared footer builder; markdown has no footer
  // element to hang them on, so it states them itself — and must not lose them.
  it("carries the license, crawler and privacy sentences", () => {
    for (const clause of [LICENSE_CORPUS, CRAWLERS_UNCHANGED, PRIVACY]) {
      expect(agentsMd).toContain(clause);
    }
  });

  it("ends with exactly one trailing newline", () => {
    expect(agentsMd.endsWith("\n")).toBe(true);
    expect(agentsMd.endsWith("\n\n")).toBe(false);
  });
});
