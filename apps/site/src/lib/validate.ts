import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "@coffeejson/core/schema";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validator = ajv.compile(schema);

export interface ValidationIssue { path: string; message: string }

export function validateDocument(doc: unknown): ValidationIssue[] {
  if (validator(doc)) return [];
  return (validator.errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    message: e.message ?? "invalid",
  }));
}
