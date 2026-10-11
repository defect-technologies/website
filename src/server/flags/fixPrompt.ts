import "server-only";
import type { Flag } from "../db/schema";

/** What a founder pastes into Claude Code so it can fix a flag without them reading any logs. */
export function fixPrompt(flag: Flag, businessName: string | null): string {
  return [
    `Fix this problem from the Defect Technologies review queue (flag ${flag.id}).`,
    "",
    `Problem: ${flag.headline || flag.whatHappened}`,
    flag.ask ? `What's needed: ${flag.ask}` : null,
    businessName ? `Lead: ${businessName} (${flag.businessId})` : null,
    flag.link ? `Link: ${flag.link}` : null,
    "",
    "What the bots reported:",
    flag.details,
    "",
    "Find the cause in the defect-tech, site-kit and website repos (and the runner logs, if it's a build or launch). Fix it, merge and deploy as usual, retry whatever failed, and then mark this flag fixed with a note saying what you changed.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
