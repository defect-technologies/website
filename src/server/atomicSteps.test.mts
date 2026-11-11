import assert from "node:assert/strict";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, mock, test } from "node:test";

mock.module("server-only", { namedExports: {} });

// The local database lives under the working directory; this file gets its own so it cannot collide with other test files.
const repoRoot = process.cwd();
const ownDirectory = mkdtempSync(path.join(tmpdir(), "atomic-steps-"));
symlinkSync(path.join(repoRoot, "drizzle"), path.join(ownDirectory, "drizzle"));
process.chdir(ownDirectory);
after(() => {
  process.chdir(repoRoot);
  rmSync(ownDirectory, { recursive: true, force: true });
});

let sends = 0;
let failNextSend = false;
let launchRecordFails = true;
const delivered: string[] = [];
const reportSite = (slug: string) => ({ slug, ownerEmail: `${slug}@example.com`, ownerFirstName: "Pat", businessName: slug, url: `https://${slug}.example.com`, businessId: null });

const welcome = await import("./onboarding/welcome");
const notify = await import("./flags/notify");
const clientSites = await import("./sites/clientSites");
mock.module("./onboarding/welcome", { namedExports: { ...welcome, studioMailboxId: async () => null } });
mock.module("./flags/notify", { namedExports: { ...notify, emailFounders: async () => {}, alertFounders: async () => {} } });
mock.module("./mail/outbox", {
  namedExports: {
    deliver: async (build: (from: null) => { to: string }) => {
      sends += 1;
      delivered.push(build(null).to);
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (failNextSend) {
        failNextSend = false;
        throw new Error("mail is down");
      }
    },
  },
});
mock.module("./sites/clientSites", {
  namedExports: {
    ...clientSites,
    sitesWithProjects: async () => [reportSite("report-one"), reportSite("report-two")],
    saveLaunchedSite: async (...args: Parameters<typeof clientSites.saveLaunchedSite>) => {
      if (launchRecordFails) throw new Error("database hiccup");
      return clientSites.saveLaunchedSite(...args);
    },
  },
});
mock.module("./portal/context", { namedExports: { analyticsProject: (found: { slug: string }) => found.slug } });
mock.module("./integrations/webAnalytics", {
  namedExports: {
    analyticsBetween: async (project: string) => {
      if (project === "report-two") throw new Error("analytics timed out");
      return { state: "ok", data: { visitors: { now: 100, before: 50 }, sources: [], pages: [], actions: [] } };
    },
  },
});
mock.module("@/lib/siteAnalytics", { namedExports: { totalActions: () => ({ now: 1, before: 0 }) } });
mock.module("@/lib/monthlyReport", { namedExports: { plural: () => "1 person", reportBody: () => "Hello" } });

async function newRequest(fields: Record<string, unknown> = {}) {
  const { db } = await import("./db/client");
  const { inboundRequests } = await import("./db/schema");
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [row] = await (await db())
    .insert(inboundRequests)
    .values({ source: "form", kind: "request", email: `claims-${stamp}@example.com`, name: "Pat Lee", businessName: `Claims ${stamp}`, about: "A bakery", ...fields } as never)
    .returning();
  return row;
}

test("two declines with a reply send one email", async () => {
  const { declineRequest, inboundById } = await import("./inbound/requests");
  const request = await newRequest();
  sends = 0;
  const results = await Promise.allSettled([declineRequest(request.id, "Sorry, not now.", "a"), declineRequest(request.id, "Sorry, not now.", "b")]);
  assert.equal(sends, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal((await inboundById(request.id))?.status, "declined");
});

test("two closes with a reply send one email", async () => {
  const { closeRequest } = await import("./inbound/requests");
  const request = await newRequest({ kind: "founder" });
  sends = 0;
  const results = await Promise.allSettled([closeRequest(request.id, "Thanks!", "a"), closeRequest(request.id, "Thanks!", "b")]);
  assert.equal(sends, 1);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
});

test("a send that fails puts the request back to open so it can be tried again", async () => {
  const { declineRequest, inboundById } = await import("./inbound/requests");
  const request = await newRequest();
  failNextSend = true;
  await assert.rejects(declineRequest(request.id, "Sorry.", "a"), /mail is down/);
  const after = await inboundById(request.id);
  assert.equal(after?.status, "open");
  assert.equal(after?.decidedBy, "");
  await declineRequest(request.id, "Sorry.", "a");
  assert.equal((await inboundById(request.id))?.status, "declined");
});

test("two accepts make one lead", async () => {
  const { acceptRequest } = await import("./inbound/requests");
  const { db } = await import("./db/client");
  const { businesses } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const request = await newRequest();
  const fields = { name: request.name, email: request.email, businessName: request.businessName, website: "", about: "A bakery" };
  const results = await Promise.allSettled([acceptRequest(request.id, fields, "a"), acceptRequest(request.id, fields, "b")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1, JSON.stringify(results.map((result) => (result.status === "rejected" ? String(result.reason) : "ok"))));
  const leads = await (await db()).select().from(businesses).where(eq(businesses.email, request.email));
  assert.equal(leads.length, 1);
});

test("two bot replies to one email send one email", async () => {
  const { replyToInbound } = await import("./bots/inbound");
  const request = await newRequest({ source: "email", kind: "bot", subject: "Hours?" });
  const key = { bot: "client_care", name: "client-care" } as never;
  sends = 0;
  const results = await Promise.allSettled([replyToInbound(key, request.id, { body: "We open at nine every day." } as never), replyToInbound(key, request.id, { body: "We open at nine every day." } as never)]);
  assert.equal(sends, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("two sorts of one email raise one flag", async () => {
  const { sortInbound } = await import("./bots/inbound");
  const { db } = await import("./db/client");
  const { flags } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const request = await newRequest({ source: "email", kind: "unsorted" });
  const key = { bot: "client_care", name: "client-care" } as never;
  const body = { kind: "founder", reason: "Wants a refund", name: "", businessName: "", website: "", about: "", flag: { headline: "Refund ask", needs: "decision", ask: "Refund?", options: [], fixer: "either", topic: "claims-test", urgent: false, details: "x" } } as never;
  const results = await Promise.allSettled([sortInbound(key, request.id, body), sortInbound(key, request.id, body)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const raised = await (await db()).select().from(flags).where(eq(flags.link, `${(await import("./inbound/requests")).requestLink(request.id)}`));
  assert.equal(raised.length, 1);
});

test("the list of past requests filters in the database, so old rows are not cut off", async () => {
  const { db } = await import("./db/client");
  const { inboundRequests } = await import("./db/schema");
  const { pastOfKinds } = await import("./inbound/requests");
  const old = await newRequest({ status: "answered", kind: "bot", at: new Date("2001-01-01") });
  const newer = Array.from({ length: 205 }, (_, index) => ({ source: "email" as const, kind: "ignore" as const, status: "closed" as const, email: `bulk-${Date.now()}-${index}@example.com`, at: new Date(Date.UTC(2998, 0, 1) - index * 1000) }));
  await (await db()).insert(inboundRequests).values(newer);
  const rows = await pastOfKinds("answered", ["bot"]);
  assert.ok(rows.some((row) => row.id === old.id));
});

test("a launch whose records fail to save stays open, so the runner's retry can finish it", async () => {
  const { db } = await import("./db/client");
  const { businesses, previewJobs } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const { reportDone } = await import("./runner/api");
  const database = await db();
  const stamp = Date.now();
  const [lead] = await database.insert(businesses).values({ businessName: "Finish test", slug: `finish-${stamp}`, linkCode: `finish-${stamp}`, stage: "paid", previewUrl: "https://p.example.com" } as never).returning();
  const [job] = await database.insert(previewJobs).values({ businessId: lead.id, kind: "launch", status: "running", requestedBy: "test" }).returning();
  const launch = { projectId: "prj_1", liveUrl: "https://finish.example.com", records: [] };

  await assert.rejects(reportDone(job.id, { status: "done", launch }), /database hiccup/);
  const [stranded] = await database.select().from(previewJobs).where(eq(previewJobs.id, job.id));
  assert.equal(stranded.status, "running");

  launchRecordFails = false;
  await reportDone(job.id, { status: "done", launch });
  const [finished] = await database.select().from(previewJobs).where(eq(previewJobs.id, job.id));
  assert.equal(finished.status, "done");
  const [after] = await database.select().from(businesses).where(eq(businesses.id, lead.id));
  assert.equal(after.vercelProjectId, "prj_1");
});

const insertPreviewJob = async (stage: string) => {
  const { db } = await import("./db/client");
  const { businesses, previewJobs } = await import("./db/schema");
  const database = await db();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [lead] = await database.insert(businesses).values({ businessName: "Hold test", slug: `hold-${stamp}`, linkCode: `hold-${stamp}`, stage } as never).returning();
  const [job] = await database.insert(previewJobs).values({ businessId: lead.id, kind: "preview", status: "running", requestedBy: "test" }).returning();
  return { lead, job, database, businesses };
};

test("a revised preview reported through done is held for review and keeps its problem line", async () => {
  const { reportDone } = await import("./runner/api");
  const { flags } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const { lead, job, database, businesses } = await insertPreviewJob("new");
  await reportDone(job.id, { status: "done", previewUrl: "https://held.example.com", criticVerdict: "Revise: held for review: cosmetic findings left", problem: "Your site loads slowly." });
  const [after] = await database.select().from(businesses).where(eq(businesses.id, lead.id));
  assert.equal(after.stage, "new");
  assert.equal(after.emailProblem, "your site loads slowly");
  const raised = await database.select().from(flags).where(eq(flags.businessId, lead.id));
  assert.ok(raised.some((flag) => flag.topic === "preview-review"));
});

test("a normal preview reported through done moves the lead on, and a done without a problem line works as before", async () => {
  const { reportDone } = await import("./runner/api");
  const { eq } = await import("drizzle-orm");
  const { lead, job, database, businesses } = await insertPreviewJob("new");
  await reportDone(job.id, { status: "done", previewUrl: "https://ready.example.com", criticVerdict: "Verdict: pass" });
  const [after] = await database.select().from(businesses).where(eq(businesses.id, lead.id));
  assert.equal(after.stage, "preview_built");
  assert.equal(after.previewUrl, "https://ready.example.com");
  assert.ok(!after.emailProblem);
});

test("a repeated done for a revised preview stays held and raises no second flag", async () => {
  const { reportDone } = await import("./runner/api");
  const { flags } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const { lead, job, database } = await insertPreviewJob("new");
  const report = { status: "done" as const, previewUrl: "https://twice.example.com", criticVerdict: "Revise: held for review: x", problem: "Your site is dated." };
  await reportDone(job.id, report);
  await assert.rejects(reportDone(job.id, report), /not claimed/);
  const raised = await database.select().from(flags).where(eq(flags.businessId, lead.id));
  assert.equal(raised.filter((flag) => flag.topic === "preview-review").length, 1);
});

test("the retry note after a failed build is the exact text the engine strips", async () => {
  const { RETRY_NOTE } = await import("./runner/api");
  assert.equal(RETRY_NOTE, "The last build of this site failed. Read verify/report.md and the latest design/critique-*.md, and fix every failure they list before anything else.");
});

test("a client is recorded as emailed right after their report goes out, so a crash later in the loop cannot re-send it", async () => {
  const { sendMonthlyReports } = await import("./reports/monthlyReport");
  const { db } = await import("./db/client");
  const { settings } = await import("./db/schema");
  const { eq } = await import("drizzle-orm");
  const now = new Date("2031-03-01T16:00:00Z");
  delivered.length = 0;
  await assert.rejects(sendMonthlyReports(now), /analytics timed out/);
  assert.deepEqual(delivered, ["report-one@example.com"]);
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, "report.monthly.2031-02"));
  assert.deepEqual(row?.value, ["report-one"]);
});
