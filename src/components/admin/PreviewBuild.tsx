import { ArrowsClockwise, CaretRight, Hammer, PaperPlaneTilt, RocketLaunch } from "@phosphor-icons/react/dist/ssr";
import { approvePreviewAction, launchSiteAction, requestPreviewAction } from "@/app/admin/(panel)/pipeline/actions";
import { JOB_STATUS_LABEL } from "@/lib/previewJobs";
import type { Business, PreviewJob } from "@/server/db/schema";
import { launchDomainOf } from "@/server/integrations/domain";
import { launchBlocker } from "@/server/runner/jobs";
import CopyCommand from "./CopyCommand";
import { TextAreaField } from "./fields";
import SubmitButton from "./SubmitButton";
import { Notice, SectionHeading, When } from "./ui";

function Queued({ job }: { job: PreviewJob }) {
  return (
    <Notice tone="good">
      {job.kind === "launch" ? "Launch: " : ""}
      {JOB_STATUS_LABEL[job.status]}
      {job.step ? `: ${job.step}` : ""}. Requested by {job.requestedBy} <When date={job.createdAt} />.
      {job.note && <span className="mt-1 block">Note: {job.note}</span>}
    </Notice>
  );
}

function RequestButton({ lead, primary }: { lead: Business; primary: boolean }) {
  return (
    <form action={requestPreviewAction}>
      <input type="hidden" name="id" value={lead.id} />
      <SubmitButton variant={primary ? "solid" : undefined} icon={<Hammer size={18} aria-hidden="true" />}>
        {lead.previewUrl ? "Rebuild preview" : "Build preview"}
      </SubmitButton>
    </form>
  );
}

/** Puts a paid client's preview live. The runner adds it to Sites when it's done, so the owner can sign in at /edit. */
function LaunchButton({ lead }: { lead: Business }) {
  const domain = launchDomainOf(lead);
  return (
    <form action={launchSiteAction} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <input type="hidden" name="id" value={lead.id} />
      <SubmitButton variant="solid" icon={<RocketLaunch size={18} aria-hidden="true" />}>{lead.vercelProjectId ? "Redeploy the live site" : "Launch site"}</SubmitButton>
      <span className="text-ink-soft text-sm">{domain ? `Live at ${domain} once its records point at Vercel` : "Live at a vercel.app address"}</span>
    </form>
  );
}

/** The design critic held this preview back. A founder sends it on once they've looked. */
function ApproveButton({ lead }: { lead: Business }) {
  return (
    <form action={approvePreviewAction} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <input type="hidden" name="id" value={lead.id} />
      <SubmitButton variant="solid" icon={<PaperPlaneTilt size={18} aria-hidden="true" />}>
        Ready to send
      </SubmitButton>
      <a href={lead.previewUrl} target="_blank" rel="noreferrer" className="text-ink-soft text-sm underline underline-offset-4 hover:text-ink">
        Look at the preview first<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </form>
  );
}

function RebuildWithNote({ lead }: { lead: Business }) {
  return (
    <details className="group/note">
      <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1 text-sm [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} className="transition-transform duration-150 group-open/note:rotate-90" aria-hidden="true" />
        Rebuild with a note
      </summary>
      <form action={requestPreviewAction} className="mt-3 flex flex-col gap-3">
        <input type="hidden" name="id" value={lead.id} />
        <TextAreaField label="What should change" name="note" id={`note-${lead.id}`} rows={3} required maxLength={2000} hint="The builder follows this over its own judgment." />
        <SubmitButton className="w-fit" icon={<ArrowsClockwise size={18} aria-hidden="true" />}>
          Rebuild with this note
        </SubmitButton>
      </form>
    </details>
  );
}

function ManualCommand({ command }: { command: string }) {
  return (
    <details className="group/manual">
      <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1 text-sm [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} className="transition-transform duration-150 group-open/manual:rotate-90" aria-hidden="true" />
        Build it on your own computer instead
      </summary>
      <div className="mt-3">
        <CopyCommand command={command} />
      </div>
    </details>
  );
}

/** The lead page's build controls: queue it for the preview runner, or run the command by hand. */
export default function PreviewBuild({ lead, job, command, missingCheckout }: { lead: Business; job: PreviewJob | null; command: string; missingCheckout: boolean }) {
  const canLaunch = !launchBlocker(lead);
  const heldBack = !job && lead.stage === "new" && Boolean(lead.previewUrl);
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading>{lead.previewUrl ? "Preview" : "Build the preview"}</SectionHeading>
      {missingCheckout && <Notice tone="warn">Add the ${lead.priceArm} Stripe payment link on the Template page, or the preview&apos;s button won&apos;t lead anywhere.</Notice>}
      {heldBack && <Notice tone="warn">The design critic asked for changes, so this preview isn&apos;t in the outreach queue.</Notice>}
      {heldBack && <ApproveButton lead={lead} />}
      {!job && canLaunch && <LaunchButton lead={lead} />}
      {job ? <Queued job={job} /> : <RequestButton lead={lead} primary={!canLaunch && !heldBack} />}
      {!job && lead.previewUrl && <RebuildWithNote lead={lead} />}
      <ManualCommand command={command} />
    </section>
  );
}
