# The recipe corpus

CoffeeJSON documents transcribed from **publicly shared,
first-party sources** — roasters' own product pages and brew guides, and
well-known published recipes. The corpus exists to prove the format against
reality: every document validates against the schema, ships through the same
harness as the fixtures, and is browsable at
[coffeejson.org/recipes](https://coffeejson.org/recipes/).

## What a document is — and is not

Each file is an **unofficial transcription**: what the source states, carried
faithfully — measurements as published, windows kept as windows, the
roaster's own words quoted, and nothing invented to fill a gap. A document
names its source (`author`, `based_on`, the bean's `url`) so every claim is
traceable. Transcriptions are made from what a source published at the time;
sources change, and a document is a reading, not the source itself.

Corrections are welcome — if a document misstates its source, open an
[issue or PR](https://github.com/coffeejson-org/coffeejson/issues).

## Licensing

The corpus's **structure and transcription** — the selection, the field
mapping, the JSON — is [CC0 1.0
Universal](https://creativecommons.org/publicdomain/zero/1.0/), like the rest
of the format's artifacts. The brew parameters themselves are unprotectable
facts. Where a document quotes a roaster's own prose (`description`,
`roaster_notes`), **that text remains the quoted source's**: it is carried as
attributed quotation with a link to the source, and it is not part of the
CC0 dedication.

**Removal on request:** a named source that wants its quoted material
corrected or removed can say so in an
[issue](https://github.com/coffeejson-org/coffeejson/issues) — both are
honored.

## `catalog.json`

`catalog.json` is a **site-index sidecar, not a CoffeeJSON document** — it
has no `coffeejson` member and holds per-document display metadata
(`slug`, source label, transcription date) for the site generator. If you
glob this directory into a parser, skip it (a conformant reader rejects it
anyway, for lacking the version marker).
