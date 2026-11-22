import type { Metadata } from "next";
import EmptyState from "@/components/admin/EmptyState";
import PoolCard from "@/components/admin/designers/PoolCard";
import { TurnList, UpNext } from "@/components/admin/turn/TurnParts";
import { Notice, PageHeader, Section } from "@/components/admin/ui";
import { messageFor } from "@/lib/messageFor";
import { requireDesigner } from "@/server/auth/designerSession";
import { pool } from "@/server/designers/claims";
import { designerTurns, placesOf } from "@/server/designers/work";

export const metadata: Metadata = { title: "To do" };

const MISSED: Record<string, string> = {
  taken: "Another designer decided on those designs first.",
  gone: "Those designs were decided or cleared before you chose.",
};

/** Everything a designer can act on: their own designs and sites first, then designs nobody has decided on yet. */
export default async function DesignerHomePage({ searchParams }: { searchParams: Promise<{ missed?: string }> }) {
  const designer = await requireDesigner();
  const missed = messageFor(MISSED, (await searchParams).missed);
  const [[next, ...rest], open] = await Promise.all([designerTurns(designer.id), pool()]);
  const places = await placesOf(open.map((board) => board.businessId));
  const designs = rest.filter((turn) => turn.kind === "design");
  const sites = rest.filter((turn) => turn.kind !== "design");
  return (
    <>
      <PageHeader title="To do" />
      {missed && <Notice tone="warn">{missed}</Notice>}
      {next && <UpNext turn={next} />}
      {sites.length > 0 && (
        <Section title="Your sites to check" count={sites.length}>
          <TurnList turns={sites} />
        </Section>
      )}
      {designs.length > 0 && (
        <Section title="Your designs to choose" count={designs.length}>
          <TurnList turns={designs} />
        </Section>
      )}
      <Section title="Open designs" count={open.length}>
        {open.length ? (
          <ul className="grid gap-5 xl:grid-cols-2">
            {open.map((board) => (
              <PoolCard key={board.id} board={board} place={places.get(board.businessId) ?? ""} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No open designs right now" />
        )}
      </Section>
    </>
  );
}
