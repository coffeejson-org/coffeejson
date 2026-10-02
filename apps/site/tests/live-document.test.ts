import { normalize } from "@coffeejson/core";
import { describe, expect, it } from "vitest";
import hero from "../src/generated/hero-document.json";
import { jsonLines } from "../src/lib/json-lines";
import { pourSeries } from "../src/lib/pour-curve.mjs";
import { landingBody } from "../src/pages/landing";

const text = (html: string): string =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

describe("jsonLines", () => {
  const sample = `{
  "title": "A <b> & \\"q\\"",
  "ratio": 16.7,
  "steps": [
    { "at_s": 0, "to_water": { "value": 60, "unit": "gram" } },
    { "at_s": 45, "to_water": { "value": 120, "unit": "gram" } }
  ],
  "finish_s": 210
}`;
  const html = jsonLines(sample);

  it("is one span per line of the file", () => {
    expect((html.match(/<span class="ln"/g) ?? []).length).toBe(
      sample.split("\n").length,
    );
  });

  it("keeps the text, moving only the indentation out of it", () => {
    const lines = html
      .split('<span class="ln"')
      .slice(1)
      .map((l) => {
        const indent = Number(/--i:(\d+)/.exec(l)![1]);
        return " ".repeat(indent) + text(l.slice(l.indexOf(">") + 1));
      });
    expect(lines.join("\n")).toBe(sample);
  });

  it("escapes what the file says", () => {
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt; &amp;");
  });

  it("marks keys and numbers, and leaves string values alone", () => {
    expect(html).toContain('<span class="k">&quot;ratio&quot;</span>:');
    expect(html).toContain('<span class="n">16.7</span>');
    expect(html).not.toContain('<span class="k">&quot;gram&quot;</span>');
  });

  it("numbers the elements of a steps array, and nothing after it", () => {
    expect([...html.matchAll(/data-step="(\d+)"/g)].map((m) => m[1])).toEqual([
      "0",
      "1",
    ]);
    expect(html).toMatch(/<span class="ln" style="--i:2">[^\n]*finish_s/);
  });
});

describe("the landing page's live document", () => {
  const body = landingBody();
  const series = pourSeries(normalize(JSON.parse(hero.text)).recipes[0]!)!;

  it("shows the corpus file as committed", () => {
    const pane = /<pre class="live-json"[^>]*><code>(.*?)<\/code><\/pre>/s.exec(
      body,
    )![1]!;
    const lines = pane
      .split('<span class="ln"')
      .slice(1)
      .map((l) => {
        const indent = Number(/--i:(\d+)/.exec(l)![1]);
        return " ".repeat(indent) + text(l.slice(l.indexOf(">") + 1));
      });
    expect(lines.join("\n")).toBe(hero.text);
  });

  // The player lights the file's line for the pour it is on. That only works
  // while each step sits on its own line, which is the corpus's formatting and
  // not a rule of the format.
  it("has a line of the file for every point on the curve", () => {
    const lines = new Set(
      [...body.matchAll(/class="ln" data-step="(\d+)"/g)].map((m) => m[1]),
    );
    for (const [, , step] of series.points)
      expect(lines.has(String(step)), `step ${step}`).toBe(true);
  });

  it("rests on its last frame, so it is complete with no script", () => {
    expect(body).toContain('style="--p:1"');
    expect(body).toMatch(/data-live-controls hidden/);
    expect(body).toContain(`data-end="${series.end}"`);
  });
});
