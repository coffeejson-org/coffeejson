// @vitest-environment node

import { DECODE_ERROR_KINDS, defaultLabels } from "@coffeejson/core";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Fail, failCopy } from "../src/pages/r-shared";

// The codec owns the reason vocabulary AND its default sentence, so a reason the
// format grows reaches a reader without this page being edited. The page words
// only what the format has no opinion about.
test("every reason the codec can give reaches a reader in the package's own words", () => {
  for (const kind of DECODE_ERROR_KINDS)
    expect(failCopy(kind)).toBe(defaultLabels.decodeErrors[kind]);
});

test("the page's own reason is its own", () => {
  expect(failCopy("unknown_slug")).toMatch(/short link/i);
});

test("an envelope with nothing in it says so, and is not called 'not a document'", () => {
  const html = renderToStaticMarkup(<Fail kind="empty_document" />);
  expect(html).toContain(defaultLabels.decodeErrors.empty_document);
  expect(html).not.toContain(defaultLabels.decodeErrors.not_a_document);
});
