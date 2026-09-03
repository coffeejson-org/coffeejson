import { FORMAT_VERSION } from "@coffeejson/core";
import schema from "@coffeejson/core/schema";
import authoringSchema from "@coffeejson/core/schema/authoring";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
// Two schemas, two questions. The open runtime schema answers "is this a
// conformant document", which is the only question with a yes or no. The strict
// authoring variant answers "did whoever produced it mean all of this", which is
// a question about a producer and never about a document's validity.
const validateRuntime = ajv.compile(schema);
const validateAuthoring = ajv.compile(authoringSchema);

export interface ValidationIssue {
  path: string;
  message: string;
}

interface AjvError {
  instancePath: string;
  message?: string;
  keyword?: string;
  params?: Record<string, unknown>;
}

// For `additionalProperties` ajv puts the offending member in `params` and
// nowhere in `message`, so two typos in one object read as two identical lines.
// For `required` it is already quoted in the message, and appending it there
// gives "must have required property \'coffee\': coffee".
function phrase(e: AjvError): string {
  const message = e.message ?? "invalid";
  const member =
    e.keyword === "additionalProperties"
      ? e.params?.additionalProperty
      : undefined;
  return typeof member === "string" ? `${message}: ${member}` : message;
}

function issuesFrom(validator: {
  errors?: AjvError[] | null;
}): ValidationIssue[] {
  return (validator.errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    message: phrase(e),
  }));
}

const minor = (v: string): number => Number(v.split(".")[1]);

/**
 * Whether the strict schema is entitled to an opinion. It knows one minor, and
 * a document from a later one carries members it cannot know about — every one
 * of which it would report as a probable typo. Silence is the honest answer.
 */
function lintable(doc: unknown): boolean {
  const stated = (doc as { coffeejson?: unknown })?.coffeejson;
  if (typeof stated !== "string") return false;
  const [major, ...rest] = stated.split(".");
  if (major !== FORMAT_VERSION.split(".")[0] || rest.length !== 1) return false;
  return minor(stated) <= minor(FORMAT_VERSION);
}

/** Conformance. A non-empty result means the document is not valid CoffeeJSON. */
export function validateDocument(doc: unknown): ValidationIssue[] {
  return validateRuntime(doc) ? [] : issuesFrom(validateRuntime);
}

/**
 * Producer lint. Only meaningful once `validateDocument` is clean, because the
 * authoring schema is the runtime schema narrowed, so an invalid document
 * repeats its own errors here. A non-empty result never means invalid: every
 * consumer must ignore what it does not recognize, so these are things a
 * producer probably did not mean rather than defects in the document.
 */
export function lintDocument(doc: unknown): ValidationIssue[] {
  if (!lintable(doc)) return [];
  return validateAuthoring(doc) ? [] : issuesFrom(validateAuthoring);
}
