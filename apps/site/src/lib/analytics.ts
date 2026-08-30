import type { CaptureResult } from "posthog-js";

// Page views only, no identity, no cookies. The whole install lives here so the
// footer sentence every page prints has one place to be checked against: anything
// this file turns on, that sentence has to survive.

/**
 * PostHog's client key is designed to ship in page source — it can only write
 * events into one project, never read them — so no build-time secret plumbing.
 */
export const POSTHOG_TOKEN = "phc_tcmDYMLBsqwDRHVkuNni7eLUACqkgfCb2dvASkPrVbfQ";

/**
 * The ingestion host, and the seam: when coffeejson.org serves a first-party
 * ingestion path, this one string changes and nothing else does.
 */
export const POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * Pins the SDK's behavioral defaults to a dated set, so a later release cannot
 * quietly switch on something the footer says is off. Raise it deliberately.
 */
export const POSTHOG_DEFAULTS = "2026-08-29";

/**
 * `/r/?d=<base64>` carries the reader's whole document in the query, so cutting it
 * here means the payload is gone before an event exists. Non-URL strings
 * (PostHog's `$direct` sentinel) pass through untouched.
 */
export function pathOnly(value: string): string {
  try {
    const url = new URL(value);
    return url.origin + url.pathname;
  } catch {
    const cut = value.search(/[?#]/);
    return cut === -1 ? value : value.slice(0, cut);
  }
}

/** Property names PostHog fills with a URL. Suffix-matched so a new one is caught too. */
const carriesUrl = (key: string): boolean =>
  /^(current_url|initial_current_url|session_entry_url|pathname)$|url$|referrer$/i.test(
    key.replace(/^\$/, ""),
  );

/**
 * Second belt, over the whole property bag rather than the one address.
 * `$referrer` is the reason it exists: a reader moving from a share link to any
 * other page would otherwise carry that link's payload along as the referrer.
 */
export function scrubUrls<T extends Record<string, unknown>>(properties: T): T {
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string" && carriesUrl(key)) {
      (properties as Record<string, unknown>)[key] = pathOnly(value);
    }
  }
  return properties;
}

/** Every option the footer sentence depends on, in one object so both can be read at once. */
export const posthogOptions = {
  api_host: POSTHOG_HOST,
  // Identity is a rotating server-side hash: nothing follows a reader between sites.
  cookieless_mode: "always",
  // Anonymous only: `identify()` is never called, so no profile by accident.
  person_profiles: "never",
  autocapture: false,
  disable_session_recording: true,
  disable_surveys: true,
  // The toolbar, recorder and survey widget all load on demand, and none may.
  disable_external_dependency_loading: true,
  // No flags call, so remote config cannot switch on what this file declined.
  advanced_disable_flags: true,
  respect_dnt: true,
  defaults: POSTHOG_DEFAULTS,
  // PostHog's own URL matching sees the trimmed address the events carry, so no
  // surface of the SDK is handed the query string.
  get_current_url: (defaultUrl: string) => pathOnly(defaultUrl),
  before_send: (event: CaptureResult | null): CaptureResult | null => {
    if (event?.properties) scrubUrls(event.properties);
    return event;
  },
} as const;

// The dev server and the jsdom suites both take the `PROD` branch out at build
// time, so neither can emit.
if (import.meta.env.PROD && typeof window !== "undefined") {
  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(POSTHOG_TOKEN, posthogOptions);
  });
}
