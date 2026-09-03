#!/usr/bin/env node
// Validates one JSON document (argv[2]) against the CoffeeJSON schema.
import { readFileSync } from "node:fs";
import { compileSchema } from "./compile-schema.mjs";

const validate = compileSchema();
const file = process.argv[2];
if (!file) {
  console.error("usage: node tools/validate-doc.mjs <document.json>");
  process.exit(2);
}
const doc = JSON.parse(readFileSync(file, "utf8"));
if (validate(doc)) {
  console.log(`ok  ${file}`);
} else {
  console.error(`FAIL  ${file}`);
  for (const e of validate.errors ?? [])
    console.error(`      ${e.instancePath || "/"} ${e.message}`);
  process.exit(1);
}
