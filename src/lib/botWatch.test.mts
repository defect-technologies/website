import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Bot } from "./bots";
import { botWatchChanges, recoveredEmail, stoppedEmail } from "./botWatch";

const now = new Date("2026-11-27T20:00:00Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("botWatchChanges", () => {
  it("reports a bot past its limit once, and not one inside it", () => {
    const checkIns = new Map<Bot, Date>([
      ["outreach", minutesAgo(80)],
      ["client_care", minutesAgo(20)],
      ["overseer", minutesAgo(80)],
    ]);
    assert.deepEqual(botWatchChanges(checkIns, new Set(), now), { stopped: ["outreach"], recovered: [] });
    assert.deepEqual(botWatchChanges(checkIns, new Set<Bot>(["outreach"]), now), { stopped: [], recovered: [] });
  });

  it("reports a reported bot that checks in again", () => {
    const checkIns = new Map<Bot, Date>([["onboarding", minutesAgo(5)]]);
    assert.deepEqual(botWatchChanges(checkIns, new Set<Bot>(["onboarding"]), now), { stopped: [], recovered: ["onboarding"] });
  });

  it("leaves a bot with no key alone", () => {
    assert.deepEqual(botWatchChanges(new Map(), new Set(), now), { stopped: [], recovered: [] });
  });
});

describe("bot watch emails", () => {
  it("names each bot and when it last checked in", () => {
    const email = stoppedEmail(["outreach", "onboarding"], new Map<Bot, Date>([["outreach", minutesAgo(80)], ["onboarding", minutesAgo(90)]]), "https://defect.tech/admin/setup/bots");
    assert.equal(email.subject, "Outreach and Onboarding stopped checking in");
    assert.match(email.body, /- Outreach: last checked in Nov 27, 2026, 10:40 AM Pacific/);
    assert.equal(recoveredEmail(["runner"], "x").subject, "Preview runner checking in again");
  });
});
