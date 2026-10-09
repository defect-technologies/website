import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import QueueList from "@/components/admin/QueueList";
import SendMeter from "@/components/admin/SendMeter";
import { Notice, PageHeader, SectionHeading } from "@/components/admin/ui";
import { stageCounts } from "@/server/leads/businesses";
import { outreachQueue, type QueueItem } from "@/server/outreach/queue";

export const metadata: Metadata = { title: "Outreach" };

function QueueSection({ title, items, limitReached }: { title: string; items: QueueItem[]; limitReached: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading count={items.length}>{title}</SectionHeading>
      <QueueList items={items} limitReached={limitReached} />
    </section>
  );
}

function NothingToSend({ waitingOnPreview }: { waitingOnPreview: number }) {
  if (waitingOnPreview === 0) {
    return (
      <EmptyState title="Nothing to send" action={<ButtonLink href="/admin/pipeline" variant="soft" icon={<ArrowRight size={18} aria-hidden="true" />}>Import leads</ButtonLink>}>
        Import a leads.csv from the lead finder to start a batch.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      title="Nothing to send"
      action={
        <ButtonLink href="/admin/pipeline?stage=new" variant="soft" icon={<ArrowRight size={18} aria-hidden="true" />}>
          See leads without a preview
        </ButtonLink>
      }
    >
      {waitingOnPreview === 1 ? "1 lead is" : `${waitingOnPreview} leads are`} waiting on a preview. Each one lands here once its preview is built.
    </EmptyState>
  );
}

export default async function OutreachPage() {
  const [queue, counts] = await Promise.all([outreachQueue(), stageCounts()]);
  const limitReached = queue.sentToday >= queue.settings.dailyLimit;
  const empty = queue.followUps.length + queue.firstEmails.length === 0;

  return (
    <>
      <PageHeader title="Outreach">
        <SendMeter sent={queue.sentToday} limit={queue.settings.dailyLimit} />
      </PageHeader>
      {limitReached && !empty && (
        <Notice tone="warn">That&apos;s today&apos;s {queue.settings.dailyLimit}. The rest can go tomorrow, or raise the limit on the Template page.</Notice>
      )}
      {empty ? (
        <NothingToSend waitingOnPreview={counts.new ?? 0} />
      ) : (
        <>
          <QueueSection title="Follow-ups due" items={queue.followUps} limitReached={limitReached} />
          <QueueSection title="Ready to send" items={queue.firstEmails} limitReached={limitReached} />
        </>
      )}
    </>
  );
}
