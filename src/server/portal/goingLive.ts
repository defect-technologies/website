import "server-only";
import { ACTIVE_JOB_STATUSES, type PreviewJobStatus } from "@/lib/previewJobs";
import { buildAndLaunchState } from "../bots/sites";
import { domainFacts, launchDomainOf } from "../integrations/domain";
import { businessById } from "../leads/businesses";
import type { OwnerSite } from "../sites/clientSites";

export type StepState = "done" | "current" | "waiting";

export type DnsRecord = { host: string; type: string; name: string; value: string };

/** Where a new client's website stands, step by step, and what the owner can do at each. */
export type GoingLive = {
  previewUrl: string;
  domain: string | null;
  dnsHost: string | null;
  makingChanges: boolean;
  liveUrl: string;
  records: DnsRecord[];
  launchFailed: boolean;
  steps: { changes: StepState; live: StepState; domain: StepState };
};

const isActive = (status: PreviewJobStatus | undefined) => Boolean(status && (ACTIVE_JOB_STATUSES as readonly string[]).includes(status));

type LaunchState = Awaited<ReturnType<typeof buildAndLaunchState>>["launch"];

function stepsFor(launch: LaunchState, domain: string | null): GoingLive["steps"] {
  const launched = launch?.status === "done";
  const domainStep: StepState = !launched ? "waiting" : !domain || launch.domainConnected ? "done" : "current";
  return {
    changes: launch ? "done" : "current",
    live: launched ? "done" : launch ? "current" : "waiting",
    domain: domainStep,
  };
}

export async function goingLiveFor(site: OwnerSite): Promise<GoingLive | null> {
  const lead = site.businessId ? await businessById(site.businessId) : null;
  if (!lead) return null;
  const domain = launchDomainOf(lead);
  const [{ previewBuild, launch }, facts] = await Promise.all([buildAndLaunchState(lead), domainFacts(lead.website).catch(() => null)]);
  return {
    previewUrl: lead.previewUrl,
    domain,
    dnsHost: facts?.dnsHost ?? null,
    makingChanges: isActive(previewBuild?.status),
    liveUrl: launch?.liveUrl ?? "",
    records: launch?.records ?? [],
    launchFailed: launch?.status === "failed",
    steps: stepsFor(launch, domain),
  };
}

/** Done once the website is live and its domain points at it. */
export const isFinished = (going: GoingLive) => Object.values(going.steps).every((state) => state === "done");
