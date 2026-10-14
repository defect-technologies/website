import type { Metadata } from "next";
import Link from "next/link";
import Conversation from "@/components/admin/Conversation";
import EmptyState from "@/components/admin/EmptyState";
import { CheckMailButton } from "@/components/admin/ThreadControls";
import { PageHeader, When } from "@/components/admin/ui";
import { businessById } from "@/server/leads/businesses";
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
        <EmptyState title="No conversations yet" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <ThreadList threads={threads} selected={business?.id} />
          {business && <Conversation business={business} thread={thread} />}
        </div>
      )}
    </>
  );
}
