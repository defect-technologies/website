import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { CheckMailButton, OptOutButton, ReplyBox } from "@/components/admin/ThreadControls";
import { ArmChip, Card, Notice, PageHeader, StageChip, When } from "@/components/admin/ui";
import type { Business, Message } from "@/server/db/schema";
import { businessById } from "@/server/leads/businesses";
import { domainOf } from "@/server/mail/mime";
import { looksLikeOptOut } from "@/server/mail/sync";
import { markThreadRead, threadFor, threadSummaries, type ThreadSummary } from "@/server/mail/threads";

export const metadata: Metadata = { title: "Messages" };

function ThreadList({ threads, selected }: { threads: ThreadSummary[]; selected?: string }) {
  return (
    <nav aria-label="Conversations">
      <ul className="flex flex-col gap-1">
        {threads.map((thread) => {
          const current = thread.business.id === selected;
          return (
            <li key={thread.business.id}>
              <Link
                href={`/admin/messages?b=${thread.business.id}`}
                aria-current={current ? "true" : undefined}
                className={`flex flex-col gap-1 rounded-xl px-3 py-2.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${current ? "bg-surface shadow-card" : "hover:bg-paper-shade"}`}
              >
                <span className="flex items-center gap-2">
                  {thread.unread > 0 && !current && <span className="bg-vermilion size-2 shrink-0 rounded-full" aria-hidden="true" />}
                  <span className={`min-w-0 flex-1 truncate ${thread.unread > 0 ? "font-semibold" : "font-medium"}`}>{thread.business.businessName}</span>
                  <span className="text-ink-faint shrink-0 text-sm">
                    <When date={thread.lastAt} />
                  </span>
                </span>
                <span className="text-ink-soft line-clamp-2 text-sm">
                  {thread.lastDirection === "out" ? "You: " : ""}
                  {thread.lastBody}
                </span>
                {thread.unread > 0 && <span className="sr-only">{thread.unread} unread</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MessageBlock({ message, business }: { message: Message; business: Business }) {
  const ours = message.direction === "out";
  return (
    <article className={`flex flex-col gap-2 rounded-2xl p-4 ${ours ? "bg-paper-shade/60 ml-6 sm:ml-12" : "bg-surface shadow-card mr-6 sm:mr-12"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-semibold">{ours ? (message.sentBy ? `Us, sent by ${message.sentBy.split("@")[0]}` : "Us") : business.businessName}</span>
        <span className="text-ink-faint">
          {ours ? `to ${message.toAddress}` : message.fromAddress}, <When date={message.at} />
        </span>
      </header>
      <p className="leading-relaxed break-words whitespace-pre-wrap">{message.body}</p>
    </article>
  );
}

function ThreadView({ business, thread }: { business: Business; thread: Message[] }) {
  const lastIncoming = [...thread].reverse().find((m) => m.direction === "in");
  const suggestOptOut = Boolean(lastIncoming && looksLikeOptOut(lastIncoming.body)) && business.stage !== "opted_out";
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold">
            <Link href={`/admin/pipeline/${business.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
              {business.businessName}
            </Link>
          </h2>
          <StageChip stage={business.stage} />
          <ArmChip arm={business.priceArm} />
        </div>
        {business.stage !== "opted_out" && <OptOutButton businessId={business.id} domain={domainOf(business.email)} suggested={suggestOptOut} />}
      </header>
      {suggestOptOut && <Notice tone="warn">Their last message reads like a no. If it is, mark them opted out so they never hear from us again.</Notice>}
      <ol className="flex flex-col gap-3">
        {thread.map((message) => (
          <li key={message.id}>
            <MessageBlock message={message} business={business} />
          </li>
        ))}
      </ol>
      {business.stage === "opted_out" ? (
        <Notice tone="bad">They opted out. Nothing more can be sent to them.</Notice>
      ) : (
        <Card className="p-4">
          <ReplyBox businessId={business.id} to={lastIncoming?.fromAddress ?? business.email} />
        </Card>
      )}
    </div>
  );
}

/** The asked-for conversation, else the first one with unread mail, else the newest. Opening it marks it read. */
async function openThread(threads: ThreadSummary[], asked?: string) {
  const selectedId = asked ?? threads.find((t) => t.unread > 0)?.business.id ?? threads[0]?.business.id;
  const business = selectedId ? await businessById(selectedId) : null;
  if (!business) return { business: null, thread: [] };
  await markThreadRead(business.id);
  return { business, thread: await threadFor(business.id) };
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ b?: string }> }) {
  const { b } = await searchParams;
  const threads = await threadSummaries();
  const { business, thread } = await openThread(threads, b);

  return (
    <>
      <PageHeader title="Messages">
        <CheckMailButton />
      </PageHeader>
      {threads.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          action={
            <Link href="/admin" className="inline-flex items-center gap-2 font-medium underline underline-offset-4">
              Go to the outreach queue <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          Every email you send from the outreach queue starts a conversation here, and replies land under it.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ThreadList threads={threads} selected={business?.id} />
          {business && <ThreadView business={business} thread={thread} />}
        </div>
      )}
    </>
  );
}
