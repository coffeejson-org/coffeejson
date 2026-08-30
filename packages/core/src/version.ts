// Values, not literals retyped at each site that emits or gates a document.

/** The version a document emitted by this build states. */
export const FORMAT_VERSION = "1.0";

/**
 * The major this build reads. Minors are forward-compatible by contract: a `1.7`
 * document is a `1.0` consumer's to read, mapping members and enum values it does
 * not know to their fallbacks. A different major is a different format.
 */
export const SUPPORTED_MAJOR = "1";

/**
 * The format's reserved media type — the `Content-Type` and `Accept` a
 * CoffeeJSON document travels under. Registration awaits publication; until
 * then it is the recommended type for headers and file associations.
 */
export const MEDIA_TYPE = "application/vnd.coffeejson+json";
