import { expect, test } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import registry from "../../../registries/implementations.json";

// An `icon` is a path /showcase renders as an <img>. A listing whose icon is
// not under public/ would ship a broken image on the format's public face —
// and a registry pull request is the one change nobody previews in a browser.
test("every registry icon is a /showcase/ path to a file under public/", () => {
  for (const i of registry.implementations) {
    const icon = (i as { icon?: string }).icon;
    if (icon === undefined) continue;
    expect(icon, i.id).toMatch(/^\/showcase\/[a-z0-9-]+\.(png|svg)$/);
    expect(existsSync(fileURLToPath(new URL(`../public${icon}`, import.meta.url))), icon).toBe(true);
  }
});
