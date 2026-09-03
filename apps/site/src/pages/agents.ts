import { guideHtml } from "../lib/agent-guide.mjs";
import {
  CRAWLERS_UNCHANGED,
  footerHtml,
  LICENSE_CORPUS,
} from "../lib/footer.mjs";
import { siteHeader } from "../lib/site-header.mjs";

/**
 * The agents-page body. Prerendered — see the note on `landingBody`.
 *
 * The guide itself lives in `src/lib/agent-guide.mjs`, because `/agents.md`
 * renders the same sections for an agent that fetches instead of rendering.
 * This module is the page around it: masthead, heading, footer.
 */
export const agentsBody = (): string => `
  ${siteHeader("/agents/")}

  <h1>For AI agents</h1>
  ${guideHtml()}

  ${footerHtml(LICENSE_CORPUS, CRAWLERS_UNCHANGED)}`;
