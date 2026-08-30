#!/usr/bin/env node
// The published schema files, copied into the package so `@coffeejson/core/schema`
// resolves offline and version-locked. `docs/schema/` is the source; this copy is
// generated on every build and test run, so it cannot drift.

import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));

export const SCHEMA_FILES = [
  "coffeejson-1.0.schema.json",
  "coffeejson-1.0.authoring.schema.json",
];

mkdirSync(join(pkg, "schema"), { recursive: true });
for (const file of SCHEMA_FILES)
  copyFileSync(join(repo, "docs", "schema", file), join(pkg, "schema", file));
