import type { Metadata } from "next";
import EmptyState from "@/components/admin/EmptyState";
import HowItWorks from "@/components/admin/designers/HowItWorks";
import InTheWorks from "@/components/admin/designers/InTheWorks";
import PoolCard from "@/components/admin/designers/PoolCard";
import { TurnList, UpNext } from "@/components/admin/turn/TurnParts";
import { Notice, PageHeader, Section } from "@/components/admin/ui";
import { messageFor } from "@/lib/messageFor";
import { requireDesigner } from "@/server/auth/designerSession";
import { pool } from "@/server/designers/claims";
import { designerBusinesses, designerTurns, placesOf } from "@/server/designers/work";

export const metadata: Metadata = { title: "To do" };

const MISSED: Record<string, string> = {
  taken: "Another designer decided on those designs first.",
  gone: "Those designs were decided or cleared before you chose.",
};

const DONE: Record<string, string> = {
  building: "We're building the site from the design you picked. When it's done, it shows up here for you to check.",
  drawing: "We're drawing three new designs from your notes. They show up here when they're ready.",
};

/** Everything a designer can act on: their own designs and sites first, then what we're working on, then designs nobody has decided on yet. */
export default async function DesignerHomePage({ searchParams }: { searchParams: Promise<{ missed?: string; done?: string }> }) {
  const designer = await requireDesigner();
  const { missed, done } = await searchParams;
  const [[next, ...rest], open, businesses] = await Promise.all([designerTurns(designer.id), pool(), designerBusinesses(designer.id)]);
  const places = await placesOf(open.map((board) => board.businessId));
  const designs = rest.filter((turn) => turn.kind === "design");
  const sites = rest.filter((turn) => turn.kind !== "design");
  const missedMessage = messageFor(MISSED, missed);
  const doneMessage = messageFor(DONE, done);
  return (
    <>
      <div className="flex flex-col gap-4">
        <PageHeader title="To do" />
        <HowItWorks open={!businesses.length} />
      </div>
      {missedMessage && <Notice tone="warn">{missedMessage}</Notice>}
      {doneMessage && <Notice tone="good">{doneMessage}</Notice>}
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
      <InTheWorks businesses={businesses} />
      <Section title="Businesses waiting for a design" count={open.length}>
        {open.length ? (
          <ul className="flex flex-col gap-4">
            {open.map((board) => (
              <PoolCard key={board.id} board={board} place={places.get(board.businessId) ?? ""} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No businesses are waiting right now" />
        )}
      </Section>
    </>
  );
}
