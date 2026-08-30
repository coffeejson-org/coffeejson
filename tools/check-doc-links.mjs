#!/usr/bin/env node
// Every relative link in the repo's Markdown resolves: a dead anchor renders
// nothing and throws nothing, so only a check catches it. Slugs follow GitHub's
// rule — lowercase, drop non-word characters except space and hyphen, spaces to
// hyphens, runs NOT collapsed (`### Espresso (dose : yield)` → `#espresso-dose--yield`).
// Pure over injected files, so the harness can prove it catches drift.

/** GitHub's heading-to-anchor slug. */
export function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/ /g, "-");
}

/** Every anchor a Markdown document defines. */
export function anchorsOf(markdown) {
  const found = new Set();
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6}) (.+)$/.exec(line);
    if (m) found.add(slug(m[2]));
  }
  return found;
}

const SITE_PREFIX = "https://coffeejson.org/";

/**
 * The repo path the canonical host serves at `href`, or null when it serves
 * none. A package README is rendered on npm, where a relative path 404s, so its
 * links are absolute — and mapped back here they stay as checked as any other.
 */
export function servedRepoPath(href) {
  if (!href.startsWith(SITE_PREFIX)) return null;
  const [rest, fragment] = href.slice(SITE_PREFIX.length).split("#");
  const path = rest === "schema/1.0" ? "docs/schema/coffeejson-1.0.schema.json"
    : rest === "schema/authoring/1.0" ? "docs/schema/coffeejson-1.0.authoring.schema.json"
    : rest.startsWith("docs/") ? rest
    : null;
  return path === null ? null : fragment ? `${path}#${fragment}` : path;
}

/**
 * @param files   Map of repo-relative POSIX path → Markdown text
 * @param exists  (repo-relative POSIX path) => boolean, for targets that are
 *                not Markdown — a schema, a fixture, a directory. Defaults to
 *                "only the Markdown passed in exists", which is what the
 *                seeded-drift probes want.
 * @returns [{ label, error }] — error null on pass
 */
export function linkFindings(files, exists = (p) => files.has(p)) {
  const findings = [];
  const anchors = new Map();
  // A Markdown file outside the caller's corpus has unknowable anchors here, so
  // the fragment goes unchecked: a crash would report nothing at all.
  const anchorsFor = (path) => {
    if (!anchors.has(path)) anchors.set(path, files.has(path) ? anchorsOf(files.get(path)) : null);
    return anchors.get(path);
  };
  const resolve = (from, href) => {
    const parts = from.split("/").slice(0, -1).concat(href.split("/"));
    const out = [];
    for (const part of parts) {
      if (part === "." || part === "") continue;
      if (part === "..") out.pop();
      else out.push(part);
    }
    return out.join("/");
  };

  for (const [path, text] of files) {
    const seen = new Set();
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const href = m[1];
      if (seen.has(href)) continue;
      seen.add(href);
      const canonical = servedRepoPath(href);
      if (canonical === null && /^(https?:|mailto:|#!)/.test(href)) continue;
      const [target, fragment] = (canonical ?? href).split("#");
      // A canonical URL names a path from the repo root; a relative one resolves
      // against the document it is written in.
      const resolved = canonical !== null ? target : target ? resolve(path, target) : path;
      if (target && !files.has(resolved) && !exists(resolved)) {
        findings.push({ label: `${path} -> ${href}`, error: "unknown target" });
        continue;
      }
      if (fragment && resolved.endsWith(".md") && anchorsFor(resolved)?.has(fragment) === false)
        findings.push({ label: `${path} -> ${href}`, error: "no heading with that anchor" });
    }
  }
  return findings;
}
