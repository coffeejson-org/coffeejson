#!/usr/bin/env node
// One ajv setup and one spelling of the schema's path, for every in-repo tool
// that validates. The day a 1.1 file appears, the filename changes here.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = fileURLToPath(new URL("..", import.meta.url));

export const SCHEMA_PATH = join(
  root,
  "docs",
  "schema",
  "coffeejson-1.0.schema.json",
);
export const AUTHORING_SCHEMA_PATH = join(
  root,
  "docs",
  "schema",
  "coffeejson-1.0.authoring.schema.json",
);

/** A fresh ajv, formats added — the setup every validating tool needs. */
export function schemaCompiler() {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return ajv;
}

export function compileSchema(path = SCHEMA_PATH) {
  return schemaCompiler().compile(JSON.parse(readFileSync(path, "utf8")));
}
