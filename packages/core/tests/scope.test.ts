import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { checkEnvelope, encodePayload, normalize, recipeJsonLd, scopeToBean, scopeToRecipe } from "../src/index.js";
import type { DecodedDocument } from "../src/index.js";

// A projection is read the one way an unchecked document may be read.
const beanIds = (d: DecodedDocument | null) => normalize(d).beans.map((b) => b.id);
const beanNames = (d: DecodedDocument | null) => normalize(d).beans.map((b) => b.name);
const recipeTitles = (d: DecodedDocument | null) => normalize(d).recipes.map((r) => r.title);
const tastingIds = (d: DecodedDocument | null) => normalize(d).tastings.map((t) => t.id);

const bean = (id: string, name: string) => ({ id, name, roaster: { name: "R" } });
const recipe = (title: string, extra: Record<string, unknown> = {}) =>
  ({ title, method: "pour_over", coffee: { value: 20, unit: "gram" },
     water: { value: 300, unit: "gram" }, ...extra });

const bagToBrew = {
  coffeejson: "1.0",
  beans: [bean("b1", "Sermon")],
  recipes: [recipe("Dwell"), recipe("French Press", { method: "french_press" })],
};

const multiBean = {
  coffeejson: "1.0",
  beans: [bean("b1", "One"), bean("b2", "Two"), bean("b3", "Three")],
  recipes: [recipe("Refs Two", { bean_ref: "b2" }), recipe("Refs Nothing")],
};

describe("scopeToRecipe", () => {
  it("takes one recipe and the single co-located bean", () => {
    const out = scopeToRecipe(bagToBrew, 0)!;
    expect(out.recipes).toHaveLength(1);
    expect(recipeTitles(out)).toEqual(["Dwell"]);
    expect(out.beans).toHaveLength(1);
    expect(beanNames(out)).toEqual(["Sermon"]);
  });

  it("follows an explicit bean_ref to exactly that bean", () => {
    expect(beanIds(scopeToRecipe(multiBean, 0))).toEqual(["b2"]);
  });

  it("omits beans entirely when a bean_ref resolves to nothing", () => {
    const doc = { ...multiBean, recipes: [recipe("Dangling", { bean_ref: "nope" })] };
    const out = scopeToRecipe(doc, 0)!;
    expect("beans" in out).toBe(false);
  });

  it("omits beans on a document that carries none", () => {
    const out = scopeToRecipe({ coffeejson: "1.0", recipes: [recipe("Alone")] }, 0)!;
    expect("beans" in out).toBe(false);
  });

  it("carries EVERY bean when an unreferenced recipe sits in a multi-bean document", () => {
    // `beans.length == 1` is what triggers implicit association, so narrowing
    // three beans to one would invent a link the source never stated.
    const out = scopeToRecipe(multiBean, 1)!;
    expect(beanIds(out)).toEqual(["b1", "b2", "b3"]);
    expect(recipeTitles(out)).toEqual(["Refs Nothing"]);
  });

  it("returns null for an index the document has no recipe at", () => {
    expect(scopeToRecipe(bagToBrew, 2)).toBeNull();
    expect(scopeToRecipe(bagToBrew, -1)).toBeNull();
    expect(scopeToRecipe({ coffeejson: "1.0" }, 0)).toBeNull();
  });

  it("is the identity on a document that already carries one recipe", () => {
    const one = {
      coffeejson: "1.0", beans: [bean("b1", "Sermon")], recipes: [recipe("Only")],
    };
    // Byte-for-byte, not merely deep-equal: the payload is what gets shared, so
    // key order is part of the contract.
    expect(encodePayload(scopeToRecipe(one, 0)!)).toBe(encodePayload(one));
  });

  it("preserves members it does not recognize", () => {
    // A projection that rebuilt the envelope from known fields would be the one
    // place forward compatibility breaks.
    const withExt = { ...bagToBrew, ext: { vendor: { note: "keep me" } } };
    const out = scopeToRecipe(withExt, 0)! as unknown as Record<string, unknown>;
    expect(out["ext"]).toEqual({ vendor: { note: "keep me" } });
  });

  it("copies members by reference-free value, never mutating the source", () => {
    const before = JSON.stringify(bagToBrew);
    scopeToRecipe(bagToBrew, 0);
    expect(JSON.stringify(bagToBrew)).toBe(before);
  });
});

describe("scopeToBean", () => {
  it("takes the bag alone, with no recipes key", () => {
    const out = scopeToBean(bagToBrew, 0)!;
    expect(beanNames(out)).toEqual(["Sermon"]);
    expect("recipes" in out).toBe(false);
  });

  it("takes exactly the bean asked for out of several", () => {
    expect(beanIds(scopeToBean(multiBean, 2))).toEqual(["b3"]);
  });

  it("returns null when there is no bean at that index", () => {
    expect(scopeToBean(bagToBrew, 1)).toBeNull();
    expect(scopeToBean({ coffeejson: "1.0", recipes: [recipe("x")] }, 0)).toBeNull();
  });

  it("preserves unknown members", () => {
    const withExt = { ...bagToBrew, ext: { keep: true } };
    expect((scopeToBean(withExt, 0)! as unknown as Record<string, unknown>)["ext"]).toEqual({ keep: true });
  });

  it("is the identity on a document that is already one bean and nothing else", () => {
    const one = { coffeejson: "1.0", beans: [bean("b1", "Solo")] };
    expect(encodePayload(scopeToBean(one, 0)!)).toBe(encodePayload(one));
  });
});

describe("totality", () => {
  // A decode establishes an envelope and nothing inside it, so these must
  // survive any JSON value in any field.
  const BATTERY: unknown[] = [
    null, undefined, true, 0, 42, -1, "x", "__proto__", "", {}, [], [null],
    { value: "x" }, { a: { b: { c: [{ d: 1 }] } } }, "x".repeat(5000),
  ];

  it("a non-document of any shape projects to null, never a throw", () => {
    for (const v of BATTERY) {
      expect(() => scopeToRecipe(v, 0)).not.toThrow();
      expect(() => scopeToBean(v, 0)).not.toThrow();
      expect(scopeToRecipe(v, 0)).toBeNull();
      expect(scopeToBean(v, 0)).toBeNull();
    }
  });

  it("any envelope member may be garbage without throwing", () => {
    const base = { coffeejson: "1.0", beans: [bean("b1", "B")], recipes: [recipe("R")] };
    for (const field of ["coffeejson", "beans", "recipes", "tastings", "generator", "ext"])
      for (const v of BATTERY) {
        const doc = { ...base, [field]: v };
        expect(() => scopeToRecipe(doc, 0), `${field}`).not.toThrow();
        expect(() => scopeToBean(doc, 0), `${field}`).not.toThrow();
      }
  });

  it("any recipe member may be garbage without throwing", () => {
    for (const field of ["bean_ref", "title", "coffee", "steps", "water"])
      for (const v of BATTERY) {
        const doc = { coffeejson: "1.0", beans: [bean("b1", "B")], recipes: [{ ...recipe("R"), [field]: v }] };
        expect(() => scopeToRecipe(doc, 0), `${field}`).not.toThrow();
      }
  });

  // A document decodePayload accepts whose `beans` is not an array.
  it("a non-array beans with a bean_ref returns the recipe unlinked, not a crash", () => {
    const doc = { coffeejson: "1.0", beans: { not: "an array" }, recipes: [{ ...recipe("R"), bean_ref: "x" }] };
    const out = scopeToRecipe(doc, 0)!;
    expect(out).not.toBeNull();
    expect(out).not.toHaveProperty("beans");
  });

  // A string `recipes` is not iterated as characters into a one-letter recipe.
  it("a non-array recipes yields null rather than a document built from a character", () => {
    expect(scopeToRecipe({ coffeejson: "1.0", recipes: "abc" }, 0)).toBeNull();
  });
});

describe("association rule", () => {
  // One rule, three readers: view-model, document projection, structured data.
  it("an unresolved bean_ref leaves the recipe unlinked in every reader", () => {
    const doc = { coffeejson: "1.0", beans: [bean("b1", "One")], recipes: [recipe("R", { bean_ref: "nope" })] };
    expect(scopeToRecipe(doc, 0)).not.toHaveProperty("beans");
    expect(normalize(doc).recipes[0]!.bean).toBeNull();
    expect(recipeJsonLd(doc, 0)!["recipeIngredient"]).toEqual(["20 g coffee", "300 g water"]);
  });

  it("a single co-located bean is the recipe's bean in every reader", () => {
    const doc = { coffeejson: "1.0", beans: [bean("b1", "Sermon")], recipes: [recipe("R")] };
    expect((scopeToRecipe(doc, 0) as { beans?: unknown[] }).beans).toHaveLength(1);
    expect(normalize(doc).recipes[0]!.bean?.name).toBe("Sermon");
    expect(recipeJsonLd(doc, 0)!["recipeIngredient"]).toEqual(["20 g coffee — Sermon (R)", "300 g water"]);
  });

  it("several beans with no ref link none, but all of them still travel", () => {
    const doc = {
      coffeejson: "1.0",
      beans: [bean("b1", "One"), bean("b2", "Two")],
      recipes: [recipe("R")],
    };
    // The projection carries every bean — narrowing would manufacture a link.
    expect((scopeToRecipe(doc, 0) as { beans?: unknown[] }).beans).toHaveLength(2);
    // But neither the view-model nor the export names one.
    expect(normalize(doc).recipes[0]!.bean).toBeNull();
    expect(recipeJsonLd(doc, 0)!["recipeIngredient"]).toEqual(["20 g coffee", "300 g water"]);
  });
});

describe("projecting tastings", () => {
  const library = {
    coffeejson: "1.0",
    beans: [bean("b1", "One"), bean("b2", "Two")],
    recipes: [
      recipe("First", { id: "r1", bean_ref: "b1" }),
      recipe("Second", { id: "r2", bean_ref: "b2" }),
    ],
    tastings: [
      { id: "t1", recipe_ref: "r1", bean_ref: "b1", rating: 4 },
      { id: "t2", recipe_ref: "r2", bean_ref: "b2", rating: 2 },
      { id: "t3", recipe_ref: "r2", bean_ref: "b2", rating: 5 },
    ],
  };

  // `tastings` does not pass through the preserve-unknown rest-spread: a
  // one-recipe projection carries only the tastings that point at that recipe.
  it("takes only the tastings of the recipe it projected", () => {
    expect(tastingIds(scopeToRecipe(library, 0))).toEqual(["t1"]);
    expect(tastingIds(scopeToRecipe(library, 1))).toEqual(["t2", "t3"]);
  });

  it("leaves no tasting pointing at a recipe the projection dropped", () => {
    for (const i of [0, 1]) {
      const out = scopeToRecipe(library, i)! as unknown as Record<string, unknown>;
      const ids = new Set((out["recipes"] as { id: string }[]).map((r) => r.id));
      for (const t of (out["tastings"] ?? []) as { recipe_ref?: string }[])
        expect(t.recipe_ref === undefined || ids.has(t.recipe_ref)).toBe(true);
    }
  });

  it("takes only the tastings of the bean it projected", () => {
    expect(tastingIds(scopeToBean(library, 0))).toEqual(["t1"]);
    expect(tastingIds(scopeToBean(library, 1))).toEqual(["t2", "t3"]);
  });

  it("omits the member entirely rather than emitting an empty array", () => {
    const out = scopeToRecipe({ ...library, tastings: [{ recipe_ref: "nowhere" }] }, 0)!;
    expect("tastings" in out).toBe(false);
  });

  // Co-location, the same rule that associates a single co-located bean: with
  // exactly one candidate, a reference is not needed to know which is meant.
  it("a tasting naming nothing travels when the document carries exactly one", () => {
    const bag = {
      coffeejson: "1.0", beans: [bean("b1", "Solo")], recipes: [recipe("Only", { id: "r1" })],
      tastings: [{ id: "t", rating: 5 }],
    };
    expect(tastingIds(scopeToRecipe(bag, 0))).toEqual(["t"]);
    expect(tastingIds(scopeToBean(bag, 0))).toEqual(["t"]);
  });

  it("a tasting naming nothing travels with none of several", () => {
    const anon = { ...library, tastings: [{ id: "t", rating: 5 }] };
    expect(tastingIds(scopeToRecipe(anon, 0))).toEqual([]);
    expect(tastingIds(scopeToBean(anon, 0))).toEqual([]);
  });

  // The substitution case must survive a projection: the tasting rides with the
  // coffee it names, not with the one its recipe calls for.
  it("a tasting follows its own bean_ref, not the recipe's", () => {
    const swap = {
      ...library,
      tastings: [{ id: "swapped", recipe_ref: "r1", bean_ref: "b2", rating: 4 }],
    };
    expect(tastingIds(scopeToBean(swap, 1))).toEqual(["swapped"]);
    expect(tastingIds(scopeToBean(swap, 0))).toEqual([]);
    expect(tastingIds(scopeToRecipe(swap, 0))).toEqual(["swapped"]);
  });

  it("is the identity on a one-recipe document that carries tastings", () => {
    const one = {
      coffeejson: "1.0", beans: [bean("b1", "Solo")], recipes: [recipe("Only", { id: "r1" })],
      tastings: [{ recipe_ref: "r1", rating: 5, measured: { tds: 1.4 } }],
    };
    expect(encodePayload(scopeToRecipe(one, 0)!)).toBe(encodePayload(one));
  });
});

describe("the corpus, projected", () => {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const docsIn = (dir: string): [string, DecodedDocument][] =>
    readdirSync(join(root, dir))
      .filter((f) => f.endsWith(".json") && f !== "catalog.json")
      .map((f) => [join(dir, f), JSON.parse(readFileSync(join(root, dir, f), "utf8"))]);
  const corpus = [...docsIn("fixtures/valid"), ...docsIn("recipes")];
  const withTastings = corpus.filter(([, d]) => Array.isArray((d as { tastings?: unknown[] }).tastings));

  it("contains documents that carry tastings (or this whole block proves nothing)", () => {
    expect(withTastings.length).toBeGreaterThan(0);
  });

  it("projects a single-recipe document to itself, byte for byte", () => {
    for (const [name, doc] of corpus) {
      if ((doc.recipes ?? []).length !== 1) continue;
      const out = scopeToRecipe(doc, 0);
      expect(out, name).not.toBeNull();
      expect(encodePayload(out!), name).toBe(encodePayload(doc));
    }
  });

  // A projection is a document, so it must survive the same intake its source
  // did, and say the same thing about the member it kept.
  it("round-trips a projection through the envelope check and the projection", () => {
    for (const [name, doc] of corpus) {
      const n = normalize(doc);
      (doc.recipes ?? []).forEach((_, i) => {
        const out = scopeToRecipe(doc, i)!;
        expect(checkEnvelope(out).ok, `${name} #${i}`).toBe(true);
        expect(normalize(out).recipes, `${name} #${i}`).toEqual([n.recipes[i]]);
      });
      (doc.beans ?? []).forEach((_, i) => {
        const out = scopeToBean(doc, i)!;
        expect(checkEnvelope(out).ok, `${name} bean ${i}`).toBe(true);
        expect(normalize(out).beans, `${name} bean ${i}`).toEqual([n.beans[i]]);
      });
    }
  });

  it("never projects a tasting whose recipe_ref the projection dropped", () => {
    for (const [name, doc] of corpus)
      for (let i = 0; i < (doc.recipes ?? []).length; i++) {
        const out = scopeToRecipe(doc, i)! as unknown as Record<string, unknown>;
        const ids = new Set((out["recipes"] as { id?: string }[]).map((r) => r.id));
        for (const t of (out["tastings"] ?? []) as { recipe_ref?: string }[])
          expect(t.recipe_ref === undefined || ids.has(t.recipe_ref), `${name} #${i}`).toBe(true);
      }
  });

  it("never projects a tasting of another bag into a bean lens", () => {
    for (const [name, doc] of corpus)
      for (let i = 0; i < (doc.beans ?? []).length; i++) {
        const out = scopeToBean(doc, i)! as unknown as Record<string, unknown>;
        const ids = new Set((out["beans"] as { id?: string }[]).map((b) => b.id));
        for (const t of (out["tastings"] ?? []) as { bean_ref?: string }[])
          expect(t.bean_ref === undefined || ids.has(t.bean_ref), `${name} #${i}`).toBe(true);
      }
  });
});

describe("beans a projected tasting names", () => {
  // The tasting's own bean_ref beats the recipe's, so projecting the recipe's
  // coffee alone mints a dangling reference in a document that still validates.
  const swap = {
    coffeejson: "1.0",
    beans: [bean("b1", "Recipe's"), bean("b2", "Drinker's")],
    recipes: [recipe("R", { id: "r1", bean_ref: "b1" })],
    tastings: [{ recipe_ref: "r1", bean_ref: "b2", rating: 4 }],
  };

  it("carries the coffee the cup was actually brewed with", () => {
    expect(beanIds(scopeToRecipe(swap, 0))).toEqual(["b1", "b2"]);
  });

  it("keeps the source's bean order rather than appending", () => {
    const reversed = { ...swap, beans: [bean("b2", "Drinker's"), bean("b1", "Recipe's")] };
    expect(beanIds(scopeToRecipe(reversed, 0))).toEqual(["b2", "b1"]);
  });

  it("adds nothing when the tasting names the recipe's own coffee", () => {
    const same = { ...swap, tastings: [{ recipe_ref: "r1", bean_ref: "b1" }] };
    expect(beanIds(scopeToRecipe(same, 0))).toEqual(["b1"]);
  });
});

// A member's position in the envelope is part of what a share link carries:
// re-encoding a single-recipe document must return the payload it started
// from, and hoisting a member is enough to break that.
describe("member order", () => {
  it("leaves a generator written after the collections where the document put it", () => {
    const trailing = {
      coffeejson: "1.0",
      beans: [bean("b1", "Solo")],
      recipes: [recipe("Only")],
      generator: { name: "ExampleBrewApp" },
    };
    expect(Object.keys(scopeToRecipe(trailing, 0)!)).toEqual(["coffeejson", "beans", "recipes", "generator"]);
    expect(encodePayload(scopeToRecipe(trailing, 0)!)).toBe(encodePayload(trailing));
  });

  it("keeps an unknown member in its original position", () => {
    const withExt = {
      coffeejson: "1.0", ext: { keep: true }, recipes: [recipe("Only")],
    };
    expect(Object.keys(scopeToRecipe(withExt, 0)!)).toEqual(["coffeejson", "ext", "recipes"]);
  });
});
