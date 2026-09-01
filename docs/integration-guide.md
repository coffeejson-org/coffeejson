# Integrating CoffeeJSON

How to make an application speak CoffeeJSON: read documents in, write them
out, and behave well beside other implementations. This guide is
**non-normative**. Every rule here links to its normative home in the
[specification](README.md).

Two roles are defined in the [Overview](spec/01-overview.md#conformance-language).
A **consumer** reads documents. A **producer** emits them. Most
implementations are both, but the roles are independent. Importing well is
valuable on its own, and so is exporting well. What conformance requires of
each is specified in [Versioning § Conformance](spec/07-versioning.md#conformance).
This guide walks the same ground in build order.

## Consuming — the import checklist

**1 · Accept the intake channels you have.** Every form below carries the same
**envelope**: a JSON object with a `coffeejson` version marker and its `beans`,
`recipes` and `tastings` collections. A document arrives in one of
four forms: a plain `.json` file with media type
[`application/vnd.coffeejson+json`](spec/07-versioning.md#media-type) and no
dedicated extension, a [share URL](transport.md#share-url)
(`https://<host>/r?d=<base64url payload>`), a QR code encoding that same URL,
or an [HTTP response](transport.md#http) whose body is the document. All four
carry the identical payload, so a second channel never changes your parser.
Start with the URL form, which is how documents circulate.

**2 · Extract from any host.** The host in a share URL names who serves the
fallback web page, never who may read the payload. Your scanner or link
handler SHOULD attempt `d=` extraction on **any** `http(s)` URL, including
hosts you have never seen
([Transport § Accepting links from any host](transport.md#accepting-links-from-any-host)).

**3 · Decode exactly, and reject exactly.** The decode algorithm is short and
fully specified in [Transport § Encoding](transport.md#encoding); implement it
from there, where it is normative. The repository ships
[scan-input test vectors](../fixtures/transport/scan-vectors.json) with
expected outcomes. Run your intake against them.

**Name your failures these twelve things.** Each rejecting vector states the one
it expects, as a `kind` member. Those names are the format's error vocabulary,
and both reference SDKs report exactly these:

| Outcome | What it means | TypeScript | Swift |
|---|---|---|---|
| no payload | no `d` parameter, or an empty one | `no_payload` | `.noPayload` |
| malformed base64 | characters outside the base64url alphabet | `malformed_base64` | `.malformedBase64` |
| unrecognized encoding | first byte is neither `{` nor a zlib header | `unrecognized_encoding` | `.unrecognizedEncoding` |
| damaged compression | a zlib stream that did not survive the wire | `damaged_compression` | `.damagedCompression` |
| too large | past the 8192-byte cap, as sent or after inflating | `too_large` | `.tooLarge` |
| not UTF-8 | the bytes are not text | `not_utf8` | `.notUTF8` |
| not JSON | text, but not JSON | `not_json` | `.notJSON` |
| not a document | JSON, but no usable `coffeejson` member | `not_a_document` | `.notADocument` |
| unsupported version | a major your build does not support | `unsupported_version` | `.unsupportedVersion` |
| empty document | neither `beans` nor `recipes` carries anything | `empty_document` | `.emptyDocument` |
| not a URL | a scan that is not a URL at all — scanned input only | `not_a_url` | `.notAURL` |
| not http(s) | a URL of another scheme, `javascript:` or `data:` — scanned input only | `not_http` | `.notHTTP` |

**These are decode failures only.** A document that decoded and then failed
*your* rules belongs to a separate vocabulary of your own. **Do not collapse
them.** "Not UTF-8", "not JSON" and "not a document" are three defects with
three different fixes.

**4 · Gate on the major version only.** A document declares its spec version
in the `coffeejson` member. Decide support by the **major** component. If the
major is the same and the minor is newer, accept the document. New optional
fields are invisible to you. If the major is newer, you can reject it, and
show a clear "unsupported version" message rather than an opaque failure. The
rules and their conformance keywords are in
[Versioning § The version gate](spec/07-versioning.md#the-version-gate).

**5 · Never gate imports on schema validation.** The published
[JSON Schema](https://coffeejson.org/schema/1.0) is a *producer* gate for the
current minor. It rejects vocabulary values a newer minor may define, so a
valid future document can fail it. The [fallback
rules](spec/06-vocabularies.md) govern import, not validation. See
[Versioning § The published schema](spec/07-versioning.md#the-published-schema).

**6 · Ignore the unknown, and fall back per vocabulary.** The
[forward-compatibility contract](spec/01-overview.md#the-forward-compatibility-contract-summary)
is the one rule everything else leans on. Ignore members you do not
recognize, at any depth. Never reject a document over them. Unknown *values*
of known fields follow each vocabulary's stated fallback, and the [index
table in Vocabularies](spec/06-vocabularies.md#index) lists every one. They
come in three classes. **Map to `other`** where "not listed" is itself a
usable answer (`method`, step `kind`, `process`, `form`). **Ignore the
field** where a wrong guess would assert something false (`roast_level`,
grind `size`, party `type`, each with its named recovery). **Derive from the
document** where the data answers the question (`basis` — whether a recipe is
measured to its brewed water or to what lands in the cup — from the quantities
present; `origin.type` from the item count).

**7 · Convert units, or treat the measurement as absent.** Units travel as
canonical identifiers (`gram`, `celsius`, `bar`), never display symbols.
Convert anything you recognize into your own canonical store. Treat a
measurement with an unrecognized unit as **absent**. Never guess, and never
show the wire identifier verbatim
([Vocabularies § Units](spec/06-vocabularies.md#units)).

**8 · Preserve step order, and show what you do not model.** A recipe's
`steps` array order is authoritative. Preserve a step kind you do not model
(a pour-over app that meets `tamp`) and show it read-only. See
[Recipe § Mixed-capability consumers](spec/03-recipe.md#mixed-capability-consumers).

**9 · Resolve bean↔recipe association by the one rule.** An explicit
`bean_ref` wins, by exact, case-sensitive match. An unresolved reference
leaves the recipe unlinked, never an error. A single co-located bean
associates by position. Otherwise entities are independent
([Envelope § Association](spec/02-envelope.md#association-explicit-reference)).

**10 · Preserve on re-share.** When you re-emit an unedited document you did
not author, carry the members you did not recognize rather than strip them.
When you rebuild a document from your own model you may drop what you do not
carry, and you say so. The round-trip / re-author distinction is
[Overview § Preservation on re-share](spec/01-overview.md#preservation-on-re-share).

## Producing — the export checklist

**1 · Emit canonical, locale-neutral identifiers.** Emit machine ids for
everything enumerable (`pour_over`, `washed`, `gram`). The consumer renders
localized labels. Emit URL-valued fields in URI form. Emit the linking
members — `id`, `bean_ref`, `recipe_ref` — in Unicode **NFC**, which is
load-bearing for `bean_ref` ↔ `id` matching, and human text in NFC too where
you can. Emit derived
step labels as absent. The compact statement of all producer obligations is
[Versioning § Conformant producer](spec/07-versioning.md#conformant-producer).

**2 · Lint your output with the authoring schema.** The [authoring
variant](https://coffeejson.org/schema/authoring/1.0) closes every object
except the reserved `ext` member, and rejects empty optional arrays. It
requires `bean_ref` on every recipe once you emit more than one bean. A typo'd
field name then fails your build loudly instead of being silently ignored by
every consumer forever. A second coffee cannot quietly unlink the recipes that
were associated with the first. It is a producer lint only. Never validate
*imports* against it.

**3 · Do not emit reserved names. Put private data under `ext`.** The
[reserved extensions](spec/07-versioning.md#reserved-extensions) are named
growth areas. Do not emit them as if defined. Vendor-private data is the one
exception: put it under the vendor-extension member `ext`, keyed by your
vendor identifier. Do not invent bare members on spec entities.

**4 · Share from your own domain, and run a fallback page.** A share link
lives on your domain (`yourapp.example/r?d=…`). Platform app-association
binds domains to apps, so your link is your app's link. Run a fallback page
that decodes client-side and renders a preview. Chat clients routinely open
links in in-app browsers that bypass app association
([Transport § Deep-linking](transport.md#deep-linking-and-the-fallback-page)).
Your page SHOULD NOT log the `d` parameter
([Transport § Privacy](transport.md#privacy-honestly)).

**5 · Prefer self-contained QR codes.** A QR that carries the document in the
ink works offline and needs no infrastructure. Every CoffeeJSON-aware scanner
can read it regardless of the printed host
([Transport § QR code](transport.md#qr-code)). Keep documents lean so the
code stays scannable. Trim content. Never truncate a document.

## Test against the repository

The [fixture corpus](../fixtures/README.md) is the executable contract:

- Every document in `fixtures/valid/` must import cleanly in your consumer.
- `fixtures/invalid/` documents are producer-gate rejections. Your *emitter*
  must never produce their shapes. Your importer stays lenient, per rule 6.
- [`fixtures/transport/scan-vectors.json`](../fixtures/transport/scan-vectors.json)
  pins your link intake, acceptance and rejection both.
- The [validator](https://coffeejson.org/validator/) checks any document
  in-browser against the schema.

Reference implementations live beside the spec. `@coffeejson/core`
(TypeScript: types, codec, a total `normalize`) and `@coffeejson/react`
(renderer components) are in this repository's `packages/`. `coffeejson-swift`
covers Apple platforms. They track the format and follow semver on
their own clock. See
[Versioning & conformance](spec/07-versioning.md#what-you-can-rely-on-today).

## List your implementation

[`registries/implementations.json`](../registries/implementations.json) lists
what speaks CoffeeJSON (apps, hosted services, libraries, machines) and the
transport surfaces each one `reads` and `writes`. Fallback pages use the
reading half to offer "open in your app" handoffs. Something that only
*publishes* documents belongs there as much as something that only imports
them. A one-line pull request adds yours. An optional `icon`, a square image
added under the site's `public/showcase/` in the same pull request, appears
beside your name on the showcase. Registration buys visibility, never
interoperability.
