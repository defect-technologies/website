import { ArrowUpRight, CheckCircle, CircleNotch, EnvelopeSimple, RocketLaunch } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { approvePreviewAction } from "@/app/portal/actions";
import { buttonClasses } from "@/components/Button";
import SubmitButton from "@/components/admin/SubmitButton";
import KnifeStroke from "@/components/admin/KnifeStroke";
import { Card } from "@/components/admin/ui";
import type { DnsRecord, GoingLive, StepState } from "@/server/portal/goingLive";
import CopyValue from "./CopyValue";

const changesEmail = (name: string) => `mailto:hello@defect.tech?subject=${encodeURIComponent(`Changes to ${name}'s new website`)}`;

function Step({ number, title, state, children }: { number: number; title: string; state: StepState; children?: ReactNode }) {
  return (
    <li aria-current={state === "current" ? "step" : undefined} className={`flex gap-4 ${state === "waiting" ? "opacity-55" : ""}`}>
      <span className="font-display relative isolate flex h-10 w-10 shrink-0 items-center justify-center self-start text-4xl leading-none font-black tabular-nums">
        {state === "current" && <KnifeStroke variant={number} className="text-vermilion/30 absolute -inset-x-2 inset-y-0 -z-10 h-full w-[calc(100%+1rem)]" />}
        {state === "done" ? <CheckCircle size={36} weight="fill" className="text-good" aria-label="Done" /> : number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pt-1">
        <h3 className="text-ink text-lg font-semibold">{title}</h3>
        {state === "current" && children}
      </div>
    </li>
  );
}

function ChangesStep({ going, slug, name }: { going: GoingLive; slug: string; name: string }) {
  if (going.makingChanges) {
    return (
      <p className="text-ink-soft flex items-center gap-2">
        <CircleNotch size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        We&apos;re making your changes. We&apos;ll email you when they&apos;re ready to look at.
      </p>
    );
  }
  return (
    <>
      <p className="text-ink-soft text-pretty">Look over your new website. When it&apos;s ready, we&apos;ll put it live. If you&apos;d like anything changed first, email us.</p>
      <div className="flex flex-wrap gap-3">
        <a href={going.previewUrl} target="_blank" rel="noopener" className={buttonClasses("soft")}>
          Open my new website
          <ArrowUpRight size={18} weight="bold" aria-hidden="true" />
        </a>
        <form action={approvePreviewAction}>
          <input type="hidden" name="site" value={slug} />
          <SubmitButton variant="solid" icon={<RocketLaunch size={18} weight="bold" aria-hidden="true" />}>
            Looks good, make it live
          </SubmitButton>
        </form>
        <a href={changesEmail(name)} className={buttonClasses("ghost")}>
          <EnvelopeSimple size={18} aria-hidden="true" />
          Email us changes
        </a>
      </div>
    </>
  );
}

function LiveStep({ going }: { going: GoingLive }) {
  if (going.launchFailed) return <p className="text-ink-soft text-pretty">Something went wrong putting your website live. We&apos;ve been told, and we&apos;ll email you once it&apos;s fixed.</p>;
  return (
    <p className="text-ink-soft flex items-center gap-2">
      <CircleNotch size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
      Your website is going live. This takes about ten minutes.
    </p>
  );
}

function RecordRow({ record }: { record: DnsRecord }) {
  return (
    <tr className="border-ink/10 border-t align-middle">
      <td className="py-2 pr-4 font-mono text-sm">{record.type}</td>
      <td className="py-2 pr-4 font-mono text-sm">{record.name}</td>
      <td className="py-2 pr-2 font-mono text-sm break-all">{record.value}</td>
      <td className="py-1 text-right">
        <CopyValue value={record.value} label={`the ${record.type} value`} />
      </td>
    </tr>
  );
}

function DomainStep({ going }: { going: GoingLive }) {
  const where = going.dnsHost ? `at ${going.dnsHost}` : "where your domain is managed";
  return (
    <>
      <p className="text-ink-soft text-pretty">
        Your website is live at{" "}
        <a href={going.liveUrl} target="_blank" rel="noopener" className="text-ink underline underline-offset-4">
          {new URL(going.liveUrl).host}
        </a>
        . To show it at {going.domain}, sign in {where} and add these records:
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="text-ink-faint text-sm">
            <tr>
              <th scope="col" className="pb-1 font-normal">Type</th>
              <th scope="col" className="pb-1 font-normal">Name</th>
              <th scope="col" className="pb-1 font-normal">Value</th>
              <th scope="col" className="sr-only">Copy</th>
            </tr>
          </thead>
          <tbody>
            {going.records.map((record) => (
              <RecordRow key={`${record.type}-${record.name}`} record={record} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-ink-soft text-sm text-pretty">Change only these. Your email keeps working because its records stay as they are. This step turns green once {going.domain} shows your new website. If you&apos;d rather we did it, reply to our email.</p>
    </>
  );
}

/** A new client's checklist, from the preview to their domain: what's done, what's happening, and what they can do now. */
export default function GoingLiveSteps({ going, slug, name }: { going: GoingLive; slug: string; name: string }) {
  return (
    <Card className="flex flex-col gap-6 p-6 sm:p-8">
      <h2 className="text-2xl font-semibold">Getting your website live</h2>
      <ol className="flex flex-col gap-7">
        <Step number={1} title="Tell us what to change" state={going.steps.changes}>
          <ChangesStep going={going} slug={slug} name={name} />
        </Step>
        <Step number={2} title="Your website goes live" state={going.steps.live}>
          <LiveStep going={going} />
        </Step>
        {going.domain && (
          <Step number={3} title={`Connect ${going.domain}`} state={going.steps.domain}>
            <DomainStep going={going} />
          </Step>
        )}
      </ol>
    </Card>
  );
}
