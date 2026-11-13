import { Hammer, SunHorizon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import KnifeStroke from "@/components/admin/KnifeStroke";
import { requireFounder } from "@/server/auth/session";
import { runnerStatus } from "@/server/runner/status";
import { turns } from "@/server/turn";

export const metadata: Metadata = { title: "Your turn" };

/** What the runner is doing while nothing waits, so a founder knows whether an email is on its way. */
function BuildingNow({ names, queued }: { names: string[]; queued: number }) {
  if (!names.length && !queued) return <p className="text-ink-soft text-pretty">The runner has nothing to build. You get an email when a design or a site is ready.</p>;
  const later = queued ? ` ${queued} more ${queued === 1 ? "waits" : "wait"} in the queue.` : "";
  return (
    <p className="text-ink-soft text-pretty">
      {names.length ? `The runner is building ${names.join(" and ")}.` : "The runner starts the next build in about a minute."}
      {later} You get an email when it is ready.
    </p>
  );
}

/**
 * One queue for a founder's taste: it opens the next design to choose or site to look at, and every decision comes back
 * here for the one after. When nothing waits it says so on the whole screen, with what the runner is doing.
 */
export default async function TurnPage() {
  await requireFounder();
  const [next] = await turns();
  if (next) redirect(next.href);
  const builds = await runnerStatus();
  return (
    <div className="bg-paper max-lg:fixed max-lg:inset-0 max-lg:z-20 flex flex-col justify-center gap-6 px-6 py-16 lg:min-h-[60svh] lg:px-0">
      <div className="relative isolate flex max-w-md flex-col gap-3">
        <KnifeStroke className="text-good/25 absolute -inset-x-4 -top-3 -z-10 h-16 w-64" />
        <h1 className="font-display text-4xl leading-none font-black text-balance">Nothing waits for you</h1>
        <BuildingNow names={builds.current.map((job) => job.businessName)} queued={builds.queue.length} />
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/admin" variant="solid" icon={<SunHorizon size={18} aria-hidden="true" />}>
          Open Today
        </ButtonLink>
        <ButtonLink href="/admin/builds" variant="soft" icon={<Hammer size={18} aria-hidden="true" />}>
          See what is building
        </ButtonLink>
      </div>
    </div>
  );
}
