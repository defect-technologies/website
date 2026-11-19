import type { Metadata } from "next";
import EmptyState from "@/components/admin/EmptyState";
import PoolCard from "@/components/admin/designers/PoolCard";
import { Notice, PageHeader } from "@/components/admin/ui";
import { messageFor } from "@/lib/messageFor";
import { requireDesigner } from "@/server/auth/designerSession";
import { pool } from "@/server/designers/claims";
import { placesOf } from "@/server/designers/work";
import { claimAction } from "../actions";

export const metadata: Metadata = { title: "Take a design" };

const MISSED: Record<string, string> = {
  taken: "Another designer took that design first. Pick another one.",
  gone: "Those designs were decided or cleared before you took them. Pick another one.",
};

/**
 * Every business whose designs wait for a choice and that no designer has taken. Taking one makes it yours: you choose
 * its design, review its build, and no other designer can.
 */
export default async function PoolPage({ searchParams }: { searchParams: Promise<{ missed?: string }> }) {
  await requireDesigner();
  const missed = messageFor(MISSED, (await searchParams).missed);
  const open = await pool();
  const places = await placesOf(open.map((board) => board.businessId));
  return (
    <>
      <PageHeader title="Take a design" />
      {missed && <Notice tone="warn">{missed}</Notice>}
      {open.length ? (
        <ul className="grid gap-5 xl:grid-cols-2">
          {open.map((board) => (
            <PoolCard key={board.id} board={board} place={places.get(board.businessId) ?? ""} claim={claimAction} />
          ))}
        </ul>
      ) : (
        <EmptyState title="No design waits for a designer">New designs land here as the runner draws them. Each one goes to the first designer who takes it.</EmptyState>
      )}
    </>
  );
}
