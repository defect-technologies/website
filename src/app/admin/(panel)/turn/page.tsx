import { Hammer, SunHorizon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import { TurnList, UpNext } from "@/components/admin/turn/TurnParts";
import { PageHeader, Section } from "@/components/admin/ui";
import { requireFounder } from "@/server/auth/session";
import { runnerStatus } from "@/server/runner/status";
import { turns } from "@/server/turn";

export const metadata: Metadata = { title: "Your turn" };

/** What the runner is doing while nothing waits, so a founder knows whether an email is on its way. */
function buildingNow(names: string[], queued: number): string {
  if (!names.length && !queued) return "The runner has nothing to build. You get an email when a design or a site is ready.";
  const now = names.length ? `The runner is working on ${names.join(" and ")}.` : "The runner starts the next job in about a minute.";
  const later = queued ? ` ${queued} more ${queued === 1 ? "waits" : "wait"} in the queue.` : "";
  return `${now}${later} You get an email when something is ready.`;
}

async function NothingWaits() {
  const builds = await runnerStatus();
  return (
    <EmptyState
      title="Nothing waits for you"
      action={
        <div className="mt-2 flex flex-wrap gap-3">
          <ButtonLink href="/admin" variant="solid" icon={<SunHorizon size={18} aria-hidden="true" />}>
            Open Today
          </ButtonLink>
          <ButtonLink href="/admin/builds" variant="soft" icon={<Hammer size={18} aria-hidden="true" />}>
            See what is building
          </ButtonLink>
        </div>
      }
    >
      {buildingNow(
        builds.current.map((job) => job.businessName),
        builds.queue.length,
      )}
    </EmptyState>
  );
}

/**
 * Everything that waits for a founder's taste on one page: the item to take now, big, then the rest by kind. Every
 * decision on Designs or Review comes back here.
 */
export default async function TurnPage() {
  await requireFounder();
  const [next, ...rest] = await turns();
  const designs = rest.filter((turn) => turn.kind === "design");
  const sites = rest.filter((turn) => turn.kind !== "design");
  return (
    <>
      <PageHeader title="Your turn" />
      {next ? <UpNext turn={next} /> : <NothingWaits />}
      {designs.length > 0 && (
        <Section title="Designs to choose" count={designs.length}>
          <TurnList turns={designs} />
        </Section>
      )}
      {sites.length > 0 && (
        <Section title="Sites to check" count={sites.length}>
          <TurnList turns={sites} />
        </Section>
      )}
    </>
  );
}
