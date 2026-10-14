import { CaretRight, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import FlagCard, { ResolvedFlags } from "@/components/admin/FlagCard";
import { FounderEmailCard, RequestCard, type MatchedLead } from "@/components/admin/InboundCards";
import { EmailRow, PastRow, ResortButtons } from "@/components/admin/InboundRows";
import AgentRow from "@/components/admin/overview/AgentRow";
import LiveRefresh from "@/components/admin/overview/LiveRefresh";
import QueueList from "@/components/admin/QueueList";
import SendMeter from "@/components/admin/SendMeter";
import SettleCard from "@/components/admin/SettleCard";
import SpotCheckCard from "@/components/admin/SpotCheckCard";
import { CheckMailButton } from "@/components/admin/ThreadControls";
import { Card, PageHeader, Section, StatusMark, When } from "@/components/admin/ui";
import type { InboundRequest } from "@/server/db/schema";
import type { LeadMatcher } from "@/server/inbound/requests";
import type { ThreadSummary } from "@/server/mail/threads";
import { agentStates, runnerDay } from "@/server/overview";
import { runnerStatus } from "@/server/runner/status";
import type { QueueItem } from "@/server/outreach/queue";
import { today } from "@/server/today";

export const metadata: Metadata = { title: "Today" };

type Today = Awaited<ReturnType<typeof today>>;

const matchedLead = (match: LeadMatcher, request: InboundRequest): MatchedLead => {
  const lead = match(request);
  return lead ? { id: lead.id, businessName: lead.businessName, stage: lead.stage } : null;
};

function Flags({ data }: { data: Today }) {
  const decide = data.flags.filter((row) => row.flag.needs === "decision");
  const fix = data.flags.filter((row) => row.flag.needs === "fix");
  return (
    <>
      {decide.length > 0 && (
        <Section title="Decide" count={decide.length}>
          {decide.map((row) => (
            <FlagCard key={row.flag.id} row={row} />
          ))}
        </Section>
      )}
      {fix.length > 0 && (
        <Section title="Fix" count={fix.length}>
          {fix.map((row) => (
            <FlagCard key={row.flag.id} row={row} />
          ))}
        </Section>
      )}
    </>
  );
}

function Requests({ data }: { data: Today }) {
  const total = data.requests.length + data.founderEmails.length + data.unsorted.length;
  if (total === 0) return null;
  return (
    <Section title="Requests" count={total}>
      {data.requests.map((request) => (
        <RequestCard key={request.id} request={request} lead={matchedLead(data.match, request)} />
      ))}
      {data.founderEmails.map((request) => (
        <FounderEmailCard key={request.id} request={request} />
      ))}
      {data.unsorted.length > 0 && (
        <Card className="p-5">
          <ul className="flex flex-col gap-3">
            {data.unsorted.map((request) => (
              <EmailRow key={request.id} request={request} actions={<ResortButtons request={request} kinds={["request", "ignore"]} />} />
            ))}
          </ul>
        </Card>
      )}
    </Section>
  );
}

function Replies({ threads }: { threads: ThreadSummary[] }) {
  if (threads.length === 0) return null;
  return (
    <Section title="New replies" count={threads.length}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {threads.map((thread) => (
            <li key={thread.business.id}>
              <Link href={`/admin/messages?b=${thread.business.id}`} className="hover:bg-paper-shade/60 grid gap-x-4 gap-y-0.5 px-5 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
                <span className="truncate font-semibold">{thread.business.businessName}</span>
                <span className="text-ink-soft truncate">{thread.lastBody}</span>
                <span className="text-ink-faint text-sm">
                  <When date={thread.lastAt} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

function SendGroup({ title, items, limitReached }: { title: string; items: QueueItem[]; limitReached: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-ink-soft text-sm font-medium">
        {title} <span className="text-ink-faint tabular-nums">{items.length}</span>
      </h3>
      <QueueList items={items} limitReached={limitReached} />
    </div>
  );
}

function Send({ queue }: { queue: Today["queue"] }) {
  const total = queue.requested.length + queue.followUps.length + queue.firstEmails.length;
  if (total === 0) return null;
  const limitReached = queue.sentToday >= queue.settings.dailyLimit;
  const meter = (
    <div className="flex items-center gap-3">
      {limitReached && <StatusMark icon={WarningCircle} tone="warn" label="Limit reached" detail="The rest can go tomorrow, or raise the limit in Setup > Email template." />}
      <SendMeter sent={queue.sentToday} limit={queue.settings.dailyLimit} />
    </div>
  );
  return (
    <Section id="send" title="Send" count={total} action={meter}>
      <SendGroup title="They asked us" items={queue.requested} limitReached={false} />
      <SendGroup title="Follow-ups" items={queue.followUps} limitReached={limitReached} />
      <SendGroup title="First emails" items={queue.firstEmails} limitReached={limitReached} />
    </Section>
  );
}

function SpotChecks({ data }: { data: Today }) {
  if (data.spotChecks.length === 0) return null;
  return (
    <Section id="spot-checks" title="Spot checks" count={data.spotChecks.length}>
      {data.spotChecks.map((row) => (
        <SpotCheckCard key={row.check.id} row={row} />
      ))}
    </Section>
  );
}

function SettleUp({ data }: { data: Today }) {
  if (data.settle.length === 0) return null;
  return (
    <Section title="Settle up" count={data.settle.length}>
      {data.settle.map((balance) => (
        <SettleCard key={balance.month} balance={balance} isDue />
      ))}
    </Section>
  );
}

/** What's already been dealt with, folded away. */
function Done({ data }: { data: Today }) {
  const lists = [
    { title: "Client care is answering", count: data.answering.length, body: <ul className="flex flex-col gap-3">{data.answering.map((request) => <EmailRow key={request.id} request={request} />)}</ul> },
    { title: "Resolved flags", count: data.resolved.length, body: <ResolvedFlags rows={data.resolved} /> },
    { title: "Past requests", count: data.past.length, body: <ul className="flex flex-col gap-3">{data.past.map((request) => <PastRow key={request.id} request={request} />)}</ul> },
  ].filter((list) => list.count > 0);
  if (lists.length === 0) return null;
  return (
    <details className="group/done">
      <summary className="text-ink-soft hover:text-ink inline-flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} weight="bold" className="transition-transform duration-150 group-open/done:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        Done recently
      </summary>
      <div className="mt-4 flex flex-col gap-6">
        {lists.map((list) => (
          <Card key={list.title} className="flex flex-col gap-3 p-5">
            <h3 className="font-semibold">
              {list.title} <span className="text-ink-faint font-normal tabular-nums">{list.count}</span>
            </h3>
            {list.body}
          </Card>
        ))}
      </div>
    </details>
  );
}

function nothingWaiting(data: Today) {
  const queued = data.queue.requested.length + data.queue.followUps.length + data.queue.firstEmails.length;
  return data.flags.length + data.requests.length + data.founderEmails.length + data.unsorted.length + data.replies.length + queued + data.spotChecks.length + data.settle.length === 0;
}

export default async function TodayPage() {
  const [data, agents, runner, builds] = await Promise.all([today(), agentStates(), runnerDay(), runnerStatus()]);

  return (
    <>
      <PageHeader title="Today">
        <LiveRefresh renderedAt={data.readAt} />
        <CheckMailButton />
      </PageHeader>
      <AgentRow agents={agents} now={data.readAt} runner={runner} builds={builds} />
      {nothingWaiting(data) && <EmptyState title="Nothing needs you" />}
      <Flags data={data} />
      <Requests data={data} />
      <Replies threads={data.replies} />
      <Send queue={data.queue} />
      <SpotChecks data={data} />
      <SettleUp data={data} />
      <Done data={data} />
    </>
  );
}
