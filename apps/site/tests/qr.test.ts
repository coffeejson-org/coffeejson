import { describe, expect, it } from "vitest";
import { PRINT_QUIET, pngScale, qrCode, qrFiles, qrPanel } from "../src/lib/qr";

const URL_SHORT = "https://coffeejson.org/r/?s=tetsu-kasuya-4-6-basic";
const opts = { fileName: "nano-challa", caption: "Scan", tooLargeNoun: "bean" };

// A PNG states its width in the four bytes after the IHDR tag.
const pngWidth = (dataUrl: string): number =>
  Buffer.from(dataUrl.split(",")[1] ?? "", "base64").readUInt32BE(16);

describe("pngScale", () => {
  it("is the fewest whole pixels per module that reach 1024 across", () => {
    // 41 modules and a 4-module margin on each side: 49 modules.
    expect(pngScale(41)).toBe(21);
    expect(pngScale(41) * 49).toBeGreaterThanOrEqual(1024);
    expect((pngScale(41) - 1) * 49).toBeLessThan(1024);
  });

  it("never goes under one pixel per module", () => {
    expect(pngScale(2000)).toBe(1);
  });
});

describe("qrFiles", () => {
  it("draws both files with the quiet zone print asks for", async () => {
    const screen = (await qrCode(URL_SHORT))!;
    const files = (await qrFiles(URL_SHORT))!;
    const side = screen.modules + 2 * PRINT_QUIET;
    expect(files.svg).toContain(`viewBox="0 0 ${side} ${side}"`);
    expect(files.png).toMatch(/^data:image\/png;base64,/);
    expect(pngWidth(files.png!)).toBe(side * pngScale(screen.modules));
  });

  it("is null for a link no code can hold", async () => {
    const big = Array.from({ length: 3400 }, (_, i) => "aB3xY_z9-Qw"[i % 11]);
    await expect(
      qrFiles(`https://coffeejson.org/r/?d=${big.join("")}`),
    ).resolves.toBeNull();
  });
});

describe("qrPanel", () => {
  const screen = "<svg><path/><path/></svg>";

  it("offers the files, not the code on screen, as its downloads", () => {
    const html = qrPanel(
      screen,
      { svg: "<svg>file</svg>", png: "data:image/png;base64,AAAA" },
      opts,
    );
    expect(html).toContain(screen);
    expect(html).toContain('download="nano-challa-qr.svg"');
    expect(html).toContain(encodeURIComponent("<svg>file</svg>"));
    expect(html).not.toContain(encodeURIComponent(screen));
    expect(html).toContain('download="nano-challa-qr.png"');
    expect(html).toContain('href="data:image/png;base64,AAAA"');
  });

  it("leaves the PNG out where the browser could not draw one", () => {
    const html = qrPanel(screen, { svg: "<svg>file</svg>", png: null }, opts);
    expect(html).toContain("Download SVG");
    expect(html).not.toContain("Download PNG");
  });

  it("says a link is too large rather than showing an empty panel", () => {
    expect(qrPanel(null, null, opts)).toContain("too large");
  });
});
