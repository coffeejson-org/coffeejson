# Transport

A CoffeeJSON [document](spec/02-envelope.md) is JSON. It is
**transport-agnostic**: the data model says nothing about how the bytes get
from one place to another. This document describes the recommended
*bindings*, ways to move a document that interoperate cleanly. They are
conventions, not part of the core format. A producer is free to use any of
them or none.

Four bindings are described here:

| Binding | Best for | Infra |
| --- | --- | --- |
| [File](#file) | Backup, library export, attachments | none |
| [Share URL](#share-url) | Sharing one recipe over any channel | a fallback page |
| [QR code](#qr-code) | Print, in-person, bag-to-cup | none |
| [HTTP](#http) | A catalog, or an endpoint that already exists | a server |

All four carry the **identical payload**, the same JSON document, so adding
one later never requires a format change.

## File

A document can be written to a plain `.json` file with the media type
[`application/vnd.coffeejson+json`](spec/07-versioning.md#media-type).
CoffeeJSON reserves [no dedicated extension](spec/07-versioning.md#file-extension).

- A single-recipe file is a `recipes` array of one. A library export is a
  `recipes` array of many. A bag-to-brew file pairs a one-element `beans`
  array with `recipes`.
- This is the simplest binding: no encoding beyond UTF-8 JSON. A file
  **MUST** be encoded in UTF-8 and **MUST NOT** begin with a byte-order mark
  ([RFC 8259 § 8.1](https://www.rfc-editor.org/rfc/rfc8259#section-8.1)). A
  consumer that meets one **SHOULD** discard it and read the rest, and **MUST
  NOT** reject the document for the mark alone — editors and runtimes on some
  platforms write one without asking, and JSON parsers disagree about it. It
  suits backups, email attachments, and AirDrop-style handoffs.
- On platforms that route files **by type** with a user chooser, the file is
  also the app-neutral handoff. Any app that claims the type can receive it,
  and the *recipient* picks which. It matters as soon as more than one
  CoffeeJSON-aware app exists on a device.

## Share URL

A document can be made **self-contained** inside a URL by carrying the whole
payload in a query parameter:

```
https://<host>/r?d=<base64url( utf8( document-JSON ) )>
```

For example:

```
https://coffeejson.org/r?d=eyJjb2ZmZWVqc29uIjoiMS4wIiwicmVjaXBlcyI6W3sidGl0bGUiOiJFdmVyeWRheSBWNjAiLCJjb2ZmZWUiOnsidmFsdWUiOjE1LCJ1bml0IjoiZ3JhbSJ9LCJ3YXRlciI6eyJ2YWx1ZSI6MjUwLCJ1bml0IjoiZ3JhbSJ9fV19
```

which decodes to:

```json
{
  "coffeejson": "1.0",
  "recipes": [
    {
      "title": "Everyday V60",
      "coffee": { "value": 15, "unit": "gram" },
      "water": { "value": 250, "unit": "gram" }
    }
  ]
}
```

The payload rides in the **query**, never the fragment. Chat and social
clients linkify a URL only up to `#`, so a fragment-carried document is
dropped at the tap. Nothing defines or emits a fragment form. A consumer
parses `?d=` and nothing else.

Two general rules regardless of binding:

- **Prefer `https://` links over custom URI schemes for sharing.** Clients
  reliably linkify only `http(s)://`. A custom scheme (`myapp://…`) is
  commonly left un-linkified or truncated. Reserve custom schemes for in-app
  or on-device handoffs.
- **The portability is in the payload, not the URL.** The same `d=` value
  decodes in any consumer, whatever host serves the link.

### Accepting links from any host

The rules above are the producer's side. The consumer's mirror image: a
consumer that scans QR codes or accepts pasted or shared links **SHOULD**
attempt payload extraction on **any** `http(s)` URL. It parses the URL, reads
the `d` query parameter, and decodes per [Encoding](#encoding), regardless of
the URL's host, including hosts it has never seen. The host names who serves
the [fallback page](#deep-linking-and-the-fallback-page), never who may read
the payload.

A scanner hands you **text**, not a URL, and text that is not a URL at all is
the ordinary case. So the first two steps are checks rather than parsing.
Reject what is not a URL, then what is not `http(s)`. The scheme check comes
**before** the payload is read. A `javascript:` or `data:` URL can carry a
well-formed payload, and an implementation that decodes first has already
treated it as a share link. A consumer that then opens what it scanned is one
step from executing it. Both cases are named in the
[scan vectors](../fixtures/transport/scan-vectors.json).

The reference implementations expose the whole binding as one call:
`decodeScanned(text)` in `@coffeejson/core`, and
`ShareLink.importDocument(fromScanned:)` in `coffeejson-swift`. An adopter
does not have to reassemble it from this prose.

A scanner that recognizes only its own domain lets any other producer's QR
fall through to the browser. The user lands on *that producer's* fallback
page instead of importing into the app in hand.

The fixture corpus ships [scan-input test
vectors](../fixtures/transport/scan-vectors.json): own-host, foreign-host,
extra-parameter, malformed, non-UTF-8, oversized, and empty-envelope inputs,
each with its expected outcome. A rejecting vector carries a `kind`, the name
this failure has in the
[failure vocabulary](integration-guide.md) both reference SDKs report, so an
implementation asserts on the vector's own word rather than on a name table of
its own. A consumer can test its link intake against this contract directly,
and the repository's own harness executes them.

### Privacy, honestly

- When a share link opens **app-to-app** on a device (platform app
  association), the operating system hands the URL to the app directly. The
  payload takes no server round-trip.
- Under the query binding, the payload **does** reach the fallback host when
  the link is opened in a browser. That happens with no app installed, or in
  an in-app browser that bypasses app association. The trade-off buys a link
  that works in chat channels, and it lets the fallback page render a
  server-side preview if its operator chooses to.
- A host that serves a fallback page **SHOULD NOT** log the `d` parameter.
- A recipe is low-sensitivity data. A producer that cannot let a payload
  reach any server does not put it in a URL at all. It uses the file binding,
  which never leaves the device unless the user sends it.

### Encoding

- **A payload is `base64url(JSON)` or `base64url(zlib(JSON))`.** The JSON
  document is serialized as UTF-8, optionally compressed with **zlib**
  ([RFC 1950](https://www.rfc-editor.org/rfc/rfc1950)), then encoded with
  URL-safe Base64
  ([RFC 4648 §5](https://www.rfc-editor.org/rfc/rfc4648#section-5): `-` and
  `_` instead of `+` and `/`), with padding `=` omitted. The two forms are
  told apart by the first decoded byte. See [Compression](#compression).
- **A producer MAY emit either form, and SHOULD compress.** Compression is
  the difference between a share link that survives a chat client and one
  that gets truncated. It is also the difference between a document that fits
  a scannable QR code and one that does not. A producer that cannot compress
  is still conformant: a build step without a compressor, or an encoder that
  must stay synchronous on a platform with an asynchronous compression API. So
  a producer adopts compression one surface at a time.
- **A consumer MUST read both forms.** This is not a choice. Plain payloads
  are legal permanently, so a reader that handles only the compressed form is
  as broken as one that handles only the plain form. Both appear in the
  [scan vectors](../fixtures/transport/scan-vectors.json).
- **Decoding MUST be UTF-8-aware.** In JavaScript, translate `-_` → `+/`
  and re-pad to a multiple of four. Base64-decode to *bytes*. Decompress if
  the first byte says so. Then decode the resulting bytes with
  `TextDecoder("utf-8")`. `atob` output read directly as text yields Latin-1
  and mangles any non-ASCII title.
- **A zero-byte inflate is a parse failure, not a compression failure.** A
  well-formed zlib stream that inflates to nothing has passed both the
  discriminator and the inflate, so it fails one step later, at the parser,
  like any other payload that is not JSON.
- A typical recipe is a few hundred bytes, well within practical URL-length
  limits across messaging apps, social posts, and email. Compression roughly
  halves a real document, and the saving grows with the document.
- A consumer **MUST** reject a payload that is malformed Base64 or carries
  an unrecognized encoding. It **MUST** also reject one that decodes to
  invalid JSON or yields a JSON document larger than **8192 bytes**, the
  normative size cap and a guard against pathological input. A richly
  populated bag-to-brew document stays well under it. The [scan vectors](../fixtures/transport/scan-vectors.json) pin
  the boundary, so two conformant consumers always agree on whether a given
  link imports.
- **The cap is enforced on the JSON document, so a compressed payload MUST be
  decompressed under a bound.** Stop at 8192 output bytes and reject. Never
  decompress fully and measure afterwards. For a plain payload the encoded
  length bounds the document, because Base64 expands by a fixed ratio.
  Compression severs that relation, and a kilobyte of payload can carry
  megabytes of output.

### Deep-linking and the fallback page

How a URL opens a specific app is a platform concern (deep-link /
app-association mechanisms), outside the scope of CoffeeJSON. Two
consequences shape what a share link can do:

- **Routing is per-app, so a share link is the producing app's link.**
  Platform app association (Apple Universal Links, Android App Links) binds a
  **domain to a fixed set of apps**, never a content type to "whichever app
  handles CoffeeJSON." A self-contained link lives on the producing app's (or
  a format host's) domain. There is no neutral domain that opens an
  arbitrary recipient's app. The [file binding](#file) is the content-type
  route that *does* let a recipient choose their app.
- **The fallback page is effectively required, not optional.** Chat and
  social clients routinely open links in **in-app browsers** that bypass app
  association and never reach the app. A page at `/r` that decodes the
  payload client-side, renders a read-only preview, and offers explicit
  open/save actions is the only recovery for that case and for recipients
  with no app. Under the query binding it can also render a server-side
  preview (for example link-unfurl cards) if the operator chooses.

## QR code

A QR code encodes the **same payload** as the share URL: either the
self-contained `https://…/r?d=…` URL or, for print reliability at higher data
density, a short hosted URL that resolves to the document.

- A **self-contained QR** needs no infrastructure. The document travels in
  the ink. A scan with a phone camera opens the fallback page, which renders
  the recipe. An app that scans QR codes itself can decode the `d=` payload
  directly, offline, with no registration anywhere, from [any
  host's](#accepting-links-from-any-host) QR and not only its own. The cost
  is a denser code as the payload grows.
- A **hosted-URL QR** stays sparse and is updatable after printing. The cost
  is a resolver and a network connection to fetch the document.

The choice is the producer's. The encoded document is identical either way.
The binding is host-agnostic. A roaster prints the QR against its **own
domain** if it wants the scan to land on its page, or against a neutral
format host. Every CoffeeJSON-aware reader decodes the same `d=` payload
regardless of host.

## HTTP

A document can be served over HTTP at a URL, like any other resource. This is
the binding for a producer that already runs a service: an endpoint that
returns a recipe adds a CoffeeJSON representation of it, and every
CoffeeJSON-aware consumer can read the result.

- A producer sends
  [`application/vnd.coffeejson+json`](spec/07-versioning.md#media-type) as the
  `Content-Type`. The body is plain JSON. This binding adds no Base64 and no
  encoding of its own; how the bytes are compressed on the wire is HTTP's
  business, not the format's.
- A consumer fetches the body, parses it, and then applies exactly what it
  applies to a decoded payload: the same envelope rules, in the same order,
  reported in the same [failure vocabulary](integration-guide.md). Both
  reference SDKs expose that step on its own — `checkEnvelope(value)` in
  `@coffeejson/core` — because a body from HTTP, a POST it received, and an
  opened file all arrive already parsed.
- **The 8192-byte cap does not apply here.** It exists because a payload in a
  URL has to survive a URL, and it is stated in [Encoding](#encoding) for that
  reason. A fetched body is bounded by whatever bounds the client's other
  responses.
- A [hosted-URL QR](#qr-code) resolves to exactly this.

The trade-off is the mirror of the self-contained forms'. A hosted document can
be corrected after the link is shared, so printed matter pointing at it stays
current — and it stops working when its host does, or when the reader is
offline. That durability is what the [file](#file) and the self-contained
[share URL](#share-url) buy, and what they give up. The choice is the
producer's, and a producer can offer both: the document is the same either way.

## Compression

The payload of a share URL or QR code **MAY** be compressed with **zlib**
([RFC 1950](https://www.rfc-editor.org/rfc/rfc1950)) before Base64. The
compression covers the payload and nothing else. A document in a file, an
HTTP body, a clipboard, or a `.json` attachment is plain JSON, unchanged.

**Why zlib.** Its first byte is `(CINFO << 4) | CM`, and **CM is always 8**
for deflate. The low nibble cannot be `B`, so a zlib stream can never begin
`{`. That makes the discriminator below structural and free. Raw DEFLATE
gives no such guarantee.

**The discriminator.** The two forms are told apart by **one byte, after the
Base64 decode**. A consumer **MUST** commit to the branch that byte selects:

- A decoded payload whose first byte is `{` (0x7B) is an uncompressed JSON
  document. This form is legal permanently. No link ever minted changes
  meaning.
- A decoded payload whose first byte has a **low nibble of 8** and whose
  first two bytes satisfy zlib's own header check is a zlib stream. That
  check is `(b0 << 8 | b1) % 31 == 0`, with the preset-dictionary bit clear —
  `(b1 & 0x20) == 0`. Decompress it under a bound (see
  [Encoding](#encoding)), then parse the result.
- A decoded payload that begins with **any other byte** is an unrecognized
  encoding. A consumer **MUST** reject it (the same class as malformed
  Base64), and never attempt to parse or guess.

Two rules that decide whether an implementation is correct:

- **Test the nibble, not the byte.** Every common compressor emits `0x78`, a
  32-KiB window, but a producer with a smaller window legitimately emits
  `0x08` through `0x68`. A consumer that tests for `0x78` exactly rejects a
  valid payload. The nibble test is two lines and can never swallow a JSON
  document.
- **Never parse first and fall back on error.** A JSON parse attempt with
  decompression only on failure puts back the ambiguity the discriminator
  exists to remove. It turns a malformed payload into a guess about its
  encoding. Dispatch, then commit.

**What a reader needs.** A share-link consumer needs a Base64 decoder, a zlib
inflate, and a JSON parser. The inflate is the one addition, and not an
exotic one. Every browser ships `DecompressionStream`, and every server
runtime and mobile platform has an equivalent. What it costs is legibility. A
plain payload can be pasted into a console and read, and a compressed one
cannot. That cost is confined to this transport. In a file, an HTTP body, or
a clipboard, a CoffeeJSON document is still plain JSON.
