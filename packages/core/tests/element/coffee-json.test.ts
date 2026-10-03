// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { encodePayload } from "../../src/codec";
import type { CoffeeJsonElement } from "../../src/element/coffee-json";
import { defineCoffeeJson } from "../../src/element/coffee-json";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const vectors: { name: string; input: string; expect: string }[] = JSON.parse(
  readFileSync(`${root}/fixtures/transport/scan-vectors.json`, "utf8"),
).vectors;

const bag = {
  coffeejson: "1.1",
  beans: [{ name: "Nano Challa", roaster: { name: "Example Roastery" } }],
};
const recipe = {
  coffeejson: "1.1",
  recipes: [
    {
      title: "Everyday V60",
      coffee: { value: 15, unit: "gram" },
      water: { value: 250, unit: "gram" },
      water_temp: { value: 94, unit: "celsius" },
    },
  ],
};

beforeAll(() => defineCoffeeJson());
afterEach(() => {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  vi.unstubAllGlobals();
});

/** Put an element on the page and wait for it to settle, one way or the other. */
const mount = (attrs: Record<string, string>, fallback = "") =>
  new Promise<CoffeeJsonElement>((done) => {
    const el = document.createElement("coffee-json") as CoffeeJsonElement;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.innerHTML = fallback;
    el.addEventListener("coffeejson-load", () => done(el));
    el.addEventListener("coffeejson-error", () => done(el));
    document.body.append(el);
  });
const settle = (el: CoffeeJsonElement) =>
  new Promise<void>((done) => {
    el.addEventListener("coffeejson-load", () => done(), { once: true });
    el.addEventListener("coffeejson-error", () => done(), { once: true });
  });
const serve = (body: string, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status })),
  );
const title = (el: CoffeeJsonElement) =>
  el.shadowRoot!.querySelector(".cj-title")?.textContent;
const showsFallback = (el: CoffeeJsonElement) =>
  el.shadowRoot!.querySelector("slot") !== null &&
  el.shadowRoot!.querySelector(".cj-view") === null;

describe("where the document comes from", () => {
  test("`d` is a share-link payload", async () => {
    const el = await mount({ d: encodePayload(bag) });
    expect(title(el)).toBe("Nano Challa");
    expect(el.hasAttribute("data-error")).toBe(false);
    expect(el.document).toEqual(bag);
  });

  test("a padded payload reads too, which is what a Liquid filter emits", async () => {
    const padded = Buffer.from(JSON.stringify(bag)).toString("base64url");
    const el = await mount({
      d: `${padded}${"=".repeat((4 - (padded.length % 4)) % 4)}`,
    });
    expect(title(el)).toBe("Nano Challa");
  });

  test("`src` is fetched, and asks for the format's media type", async () => {
    serve(JSON.stringify(recipe));
    const el = await mount({ src: "/coffees/v60.json" });
    expect(title(el)).toBe("Everyday V60");
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("/coffees/v60.json");
    expect((init!.headers as Record<string, string>)["Accept"]).toContain(
      "application/vnd.coffeejson+json",
    );
  });

  test("`d` wins over `src`, and nothing is fetched", async () => {
    serve(JSON.stringify(recipe));
    const el = await mount({ d: encodePayload(bag), src: "/x.json" });
    expect(title(el)).toBe("Nano Challa");
    expect(fetch).not.toHaveBeenCalled();
  });

  test.each(vectors.filter((v) => v.expect === "document"))(
    "scan vector $name renders from its payload",
    async (v) => {
      const el = await mount({ d: new URL(v.input).searchParams.get("d")! });
      expect(el.shadowRoot!.querySelector(".cj-view")).not.toBeNull();
    },
  );
});

describe("when there is nothing to show", () => {
  test("the children stay as the fallback, and the failure is named", async () => {
    const el = await mount({ d: "!!!" }, '<a href="/x.json">the recipe</a>');
    expect(showsFallback(el)).toBe(true);
    expect(el.getAttribute("data-error")).toBe("malformed_base64");
    expect(el.querySelector("a")!.textContent).toBe("the recipe");
  });

  test("neither attribute is `no_payload`", async () => {
    const el = await mount({});
    expect(showsFallback(el)).toBe(true);
    expect(el.getAttribute("data-error")).toBe("no_payload");
  });

  test("a server error is `fetch_failed`, with the status as its detail", async () => {
    serve("gone", 404);
    const seen: unknown[] = [];
    const el = document.createElement("coffee-json") as CoffeeJsonElement;
    el.setAttribute("src", "/missing.json");
    el.addEventListener("coffeejson-error", (e) =>
      seen.push((e as CustomEvent).detail),
    );
    const done = settle(el);
    document.body.append(el);
    await done;
    expect(el.getAttribute("data-error")).toBe("fetch_failed");
    expect(seen).toEqual([{ kind: "fetch_failed", detail: "404" }]);
  });

  test("a network failure is `fetch_failed` too", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("offline"))),
    );
    const el = await mount({ src: "/x.json" });
    expect(el.getAttribute("data-error")).toBe("fetch_failed");
  });

  test("a served body that is not a document carries the decoder's own word", async () => {
    serve('{"hello": "world"}');
    const el = await mount({ src: "/x.json" });
    expect(el.getAttribute("data-error")).toBe("not_a_document");
  });

  test("a later good document clears an earlier failure", async () => {
    const el = await mount({ d: "!!!" });
    const done = settle(el);
    el.setAttribute("d", encodePayload(bag));
    await done;
    expect(el.hasAttribute("data-error")).toBe(false);
    expect(title(el)).toBe("Nano Challa");
  });
});

describe("a slow answer", () => {
  test("a fetch still in flight never replaces a newer document", async () => {
    let answer: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((done) => (answer = done))),
    );
    const el = document.createElement("coffee-json") as CoffeeJsonElement;
    el.setAttribute("src", "/slow.json");
    document.body.append(el);
    // The page sets `d` while the fetch for `src` is pending.
    const done = settle(el);
    el.setAttribute("d", encodePayload(bag));
    await done;
    expect(title(el)).toBe("Nano Challa");
    // The old fetch comes back with a different document, and is ignored.
    answer(new Response(JSON.stringify(recipe)));
    await new Promise((r) => setTimeout(r, 0));
    expect(title(el)).toBe("Nano Challa");
    expect(el.document).toEqual(bag);
  });
});

describe("attributes that redraw", () => {
  test("`units` converts, and an unknown value is ignored", async () => {
    const el = await mount({ d: encodePayload(recipe), units: "imperial" });
    const temp = () =>
      el.shadowRoot!.querySelector('[data-cj-fact="waterTemp"]')!.textContent;
    expect(temp()).toContain("°F");
    el.setAttribute("units", "furlongs");
    expect(temp()).toContain("°C");
  });

  test("`viewer` adds an Open link carrying the payload; without it there is none", async () => {
    const el = await mount({ d: encodePayload(bag) });
    expect(el.shadowRoot!.querySelector(".cj-actions a")).toBeNull();
    el.setAttribute("viewer", "https://coffeejson.org/r/");
    const a = el.shadowRoot!.querySelector<HTMLAnchorElement>(".cj-actions a")!;
    expect(a.href).toBe(`https://coffeejson.org/r/?d=${encodePayload(bag)}`);
    el.setAttribute("viewer", "javascript:alert(1)");
    expect(el.shadowRoot!.querySelector(".cj-actions a")).toBeNull();
  });

  test("a `viewer` given as a path opens on the page's own site", async () => {
    const el = await mount({ d: encodePayload(bag), viewer: "/r/" });
    const a = el.shadowRoot!.querySelector<HTMLAnchorElement>(".cj-actions a")!;
    const u = new URL(a.href);
    expect(u.origin).toBe(location.origin);
    expect(u.pathname).toBe("/r/");
    expect(u.searchParams.get("d")).toBe(encodePayload(bag));
  });

  test("a `viewer` that is not a web address adds no link", async () => {
    const el = await mount({
      d: encodePayload(bag),
      viewer: "mailto:someone@example.com",
    });
    expect(el.shadowRoot!.querySelector(".cj-actions a")).toBeNull();
  });

  test("a `viewer` that does not parse adds no link and breaks nothing", async () => {
    const el = await mount({ d: encodePayload(bag), viewer: "https://" });
    expect(title(el)).toBe("Nano Challa");
    expect(el.hasAttribute("data-error")).toBe(false);
    expect(el.shadowRoot!.querySelector(".cj-actions a")).toBeNull();
    el.setAttribute("viewer", "https://coffeejson.org/r/");
    expect(el.shadowRoot!.querySelector(".cj-actions a")).not.toBeNull();
    el.setAttribute("viewer", "https://");
    expect(title(el)).toBe("Nano Challa");
    expect(el.shadowRoot!.querySelector(".cj-actions a")).toBeNull();
  });
});

describe("JSON-LD", () => {
  const ld = () =>
    [
      ...document.head.querySelectorAll('script[type="application/ld+json"]'),
    ].map((s) => JSON.parse(s.textContent!));

  test("nothing is added unless `jsonld` is set", async () => {
    await mount({ d: encodePayload(recipe) });
    expect(ld()).toEqual([]);
  });

  test("a recipe document adds one Recipe node; a bag adds a Product", async () => {
    await mount({ d: encodePayload(recipe), jsonld: "" });
    expect(ld().map((n) => n["@type"])).toEqual(["Recipe"]);
    await mount({ d: encodePayload(bag), jsonld: "" });
    expect(ld().map((n) => n["@type"])).toEqual(["Recipe", "Product"]);
  });

  test("removing the attribute or the element removes the script", async () => {
    const el = await mount({ d: encodePayload(recipe), jsonld: "" });
    el.removeAttribute("jsonld");
    expect(ld()).toEqual([]);
    el.setAttribute("jsonld", "");
    expect(ld()).toHaveLength(1);
    el.remove();
    expect(ld()).toEqual([]);
  });

  test("a string in a document cannot close the script tag", async () => {
    const sly = structuredClone(recipe);
    sly.recipes[0]!.title = "</script><script>alert(1)</script>";
    await mount({ d: encodePayload(sly), jsonld: "" });
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    expect(ld()[0].name).toBe("</script><script>alert(1)</script>");
    expect(document.head.querySelector("script")!.textContent).not.toContain(
      "<",
    );
  });
});

describe("registration", () => {
  test("calling it twice is safe, and a second name gets its own class", () => {
    expect(() => defineCoffeeJson()).not.toThrow();
    defineCoffeeJson("brew-card");
    expect(customElements.get("brew-card")).not.toBe(
      customElements.get("coffee-json"),
    );
    expect(document.createElement("brew-card").shadowRoot).not.toBeNull();
  });
});

describe("an element already in the page", () => {
  test("loads its document once when the script defines it later", async () => {
    serve(JSON.stringify(recipe));
    const el = document.createElement("late-card") as CoffeeJsonElement;
    el.setAttribute("src", "/late.json");
    el.setAttribute("units", "imperial");
    document.body.append(el);
    const done = settle(el);
    defineCoffeeJson("late-card");
    await done;
    expect(title(el)).toBe("Everyday V60");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("the download action", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });

  test("the blob URL is revoked after the click, not during it", async () => {
    const el = await mount({ d: encodePayload(bag) });
    const create = vi.fn((_blob: Blob) => "blob:coffee-1");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicks: { download: string; href: string; revoked: number }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push({
        download: this.download,
        href: this.href,
        revoked: revoke.mock.calls.length,
      });
    });
    vi.useFakeTimers();
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      ".cj-actions button",
    )!.click();
    expect(clicks).toEqual([
      { download: "coffee.json", href: "blob:coffee-1", revoked: 0 },
    ]);
    expect(create.mock.calls[0]![0].type).toBe(
      "application/vnd.coffeejson+json",
    );
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revoke.mock.calls).toEqual([["blob:coffee-1"]]);
  });
});

describe("what a page can hear and style", () => {
  test("both events reach a listener on the document", async () => {
    const heard: string[] = [];
    const listen = (e: Event) => heard.push(e.type);
    document.addEventListener("coffeejson-load", listen);
    document.addEventListener("coffeejson-error", listen);
    await mount({ d: encodePayload(bag) });
    await mount({ d: "not-a-payload" });
    document.removeEventListener("coffeejson-load", listen);
    document.removeEventListener("coffeejson-error", listen);
    expect(heard).toEqual(["coffeejson-load", "coffeejson-error"]);
  });

  test("both events cross a shadow boundary the element sits inside", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const inner = host.attachShadow({ mode: "open" });
    const el = document.createElement("coffee-json") as CoffeeJsonElement;
    el.setAttribute("d", encodePayload(bag));
    const heard = new Promise<Event>((done) =>
      document.addEventListener("coffeejson-load", done, { once: true }),
    );
    inner.append(el);
    expect((await heard).composed).toBe(true);
  });

  test("the button and the viewer link are parts", async () => {
    const el = await mount({
      d: encodePayload(bag),
      viewer: "https://example.com/r/",
    });
    const row = el.shadowRoot!.querySelector(".cj-actions")!;
    expect(row.querySelector("button")!.getAttribute("part")).toBe(
      "cj-download",
    );
    expect(row.querySelector("a")!.getAttribute("part")).toBe("cj-open");
  });

  test("a document that decodes and draws nothing is a failure with a name", async () => {
    const el = await mount(
      { d: encodePayload({ coffeejson: "1.1", beans: [1] }) },
      "<a href='/x'>fallback</a>",
    );
    expect(el.getAttribute("data-error")).toBe("empty_document");
    expect(el.document).toBeNull();
    expect(el.shadowRoot!.querySelector("slot")).not.toBeNull();
  });

  test("the failure is told as an error, and no load is announced", async () => {
    const heard: [string, unknown][] = [];
    const listen = (e: Event) =>
      heard.push([e.type, (e as CustomEvent).detail?.kind]);
    document.addEventListener("coffeejson-load", listen);
    document.addEventListener("coffeejson-error", listen);
    await mount({ d: encodePayload({ coffeejson: "1.1", beans: [1] }) });
    document.removeEventListener("coffeejson-load", listen);
    document.removeEventListener("coffeejson-error", listen);
    expect(heard).toEqual([["coffeejson-error", "empty_document"]]);
  });
});
