import { NextResponse } from "next/server";
import { z } from "zod";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { queueSite } from "@/server/leads/queueSite";
import { buildsToday, leadsWaitingToBuild } from "@/server/runner/jobs";
import { runnerSettings } from "@/server/runner/settings";
import { runnerStatus } from "@/server/runner/status";

const QueueBody = z.object({
  website: z.url({ protocol: /^https?$/ }),
  businessName: z.string().trim().max(120).optional(),
  /** A founder's note for the builder. Any note also means build even if the current site is already good. */
  note: z.string().trim().max(4000).optional(),
  requestedBy: z.string().trim().min(1).max(80).default("claude"),
});

/**
 * POST /api/engine/queue: queues a preview build for a business by its website, adding the lead if it's new.
 * For founders' tools and Claude: { website, businessName?, note?, requestedBy? }. A build already queued or
 * running for that lead is returned as is.
 */
export async function POST(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const parsed = QueueBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const { lead, job, createdLead, createdJob } = await queueSite(parsed.data);
  return NextResponse.json({
    ok: true,
    slug: lead.slug,
    leadCreated: createdLead,
    jobId: job.id,
    jobStatus: job.status,
    queued: createdJob,
    admin: new URL(`/admin/sites/${lead.id}`, env.siteUrl()).toString(),
  });
}

/**
 * GET /api/engine/queue: what the runner has to do, for founders' tools and Claude. The builds queued (in order),
 * the one building, how many leads are waiting to be queued by themselves, and today's count against the cap.
 */
export async function GET(request: Request) {
  if (!hasBearer(request, env.engineToken())) return NextResponse.json({ error: "Wrong or missing ENGINE_TOKEN." }, { status: 401 });
  const [status, waiting, today, settings] = await Promise.all([runnerStatus(), leadsWaitingToBuild(), buildsToday(), runnerSettings()]);
  const row = (job: { businessName: string; kind: string; requestedBy: string; note: string; createdAt: Date }) => ({ business: job.businessName, kind: job.kind, requestedBy: job.requestedBy, hasNote: job.note !== "", queuedAt: job.createdAt });
  return NextResponse.json({
    building: status.current.map(row),
    queued: status.queue.map(row),
    leadsWaitingToBeQueued: waiting,
    buildsToday: today,
    dailyCap: settings.dailyCap,
  });
}
