import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { prerender } from "./tools/prerender";

const page = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The hand-written shells stay listed one by one; the generated corpus pages are
// discovered, because naming them here would be a second list to keep in step
// with the corpus, and the corpus is what changes. `pnpm gen` writes them, which
// `prebuild` and `pretest` both run first.
const corpusPages = Object.fromEntries(
  readdirSync(page("recipes"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => [`corpus-${d.name}`, page(`recipes/${d.name}/index.html`)]),
);
// The bean pages are discovered the same way and for the same reason.
const beanPages = Object.fromEntries(
  readdirSync(page("beans"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => [`bean-${d.name}`, page(`beans/${d.name}/index.html`)]),
);

export default defineConfig({
  appType: "mpa",
  plugins: [prerender()],
  build: {
    rollupOptions: {
      input: {
        index: page("index.html"),
        validator: page("validator/index.html"),
        r: page("r/index.html"),
        recipes: page("recipes/index.html"),
        generate: page("generate/index.html"),
        agents: page("agents/index.html"),
        implementations: page("implementations/index.html"),
        showcase: page("showcase/index.html"),
        beans: page("beans/index.html"),
        ...corpusPages,
        ...beanPages,
      },
    },
  },
});
