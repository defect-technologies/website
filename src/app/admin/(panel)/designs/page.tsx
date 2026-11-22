import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { BoardPicture, Letter } from "@/components/admin/designs/parts";
import { Card, PageHeader, Section, When } from "@/components/admin/ui";
import { type BoardDecision, pickAgreement } from "@/lib/boards";
import { requireFounder } from "@/server/auth/session";
import { boardsDecided, boardsWaiting, decisionsOf, type BoardWithLead } from "@/server/boards/store";
import { claimNames } from "@/server/designers/claims";
import { deciders } from "@/server/designers/people";

export const metadata: Metadata = { title: "Designs" };

const RECENT = 12;

/** A waiting board, with the designer whose business it is when one took it: the first decision stands, theirs or a founder's. */
function Waiting({ board, designer }: { board: BoardWithLead; designer: string | undefined }) {
  return (
    <li>
      <Link href={`/admin/designs/${board.id}`} className="bg-surface shadow-card hover:shadow-card focus-visible:outline-ink ease-knife flex flex-col gap-4 rounded-2xl p-4 transition-[scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-xl font-semibold">{board.businessName}</span>
            {designer && <span className="text-ink-soft text-sm">{designer}&rsquo;s to choose</span>}
          </span>
          <span className="text-ink-faint shrink-0 text-sm">
            <When date={board.createdAt} />
          </span>
        </span>
        <span className="grid grid-cols-3 gap-3">
          {board.options.map((option) => (
            <span key={option.letter}>
              <BoardPicture src={option.pictures.phone} alt={`Option ${option.letter.toUpperCase()}, ${option.name}`} className="aspect-[390/844] rounded-lg object-cover object-top lg:hidden" />
              <BoardPicture src={option.pictures.desktop} alt={`Option ${option.letter.toUpperCase()}, ${option.name}`} className="aspect-[16/10] rounded-lg object-cover object-top max-lg:hidden" />
            </span>
          ))}
        </span>
      </Link>
    </li>
  );
}

function Chosen({ board, by }: { board: BoardWithLead; by: string }) {
  const option = board.options.find((entry) => entry.letter === board.chosenLetter);
  return (
    <li>
      <Link href={`/admin/designs/${board.id}`} className="hover:bg-paper-shade/50 focus-visible:outline-ink flex items-center gap-4 px-5 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2">
        <Letter letter={board.chosenLetter ?? "a"} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{board.businessName}</span>
          <span className="text-ink-soft truncate text-sm">{option?.name}</span>
        </span>
        <span className="text-ink-faint shrink-0 text-sm">
          {by}, <When date={board.chosenAt} />
        </span>
      </Link>
    </li>
  );
}

/** A sentence only once the system has made picks: how often its own guess was the option a founder chose. */
function Agreement({ decided }: { decided: BoardDecision[] }) {
  const { matched, of } = pickAgreement(decided);
  if (!of) return null;
  return (
    <p className="text-ink-soft max-w-prose text-pretty">
      The builder&rsquo;s own guess was the design you chose in <span className="text-ink font-semibold tabular-nums">{matched} of the last {of}</span>. When that number stays high, the choice can become automatic.
    </p>
  );
}

/** Every lead's three designs: the ones that wait for a founder first, then what was chosen. */
export default async function DesignsPage() {
  await requireFounder();
  const [waiting, decided] = await Promise.all([boardsWaiting(), boardsDecided()]);
  const [claimed, deciderOf] = await Promise.all([claimNames(waiting.map((board) => board.businessId)), deciders()]);
  return (
    <>
      <PageHeader title="Designs" />
      <Section title="Waiting for a choice" count={waiting.length}>
        {waiting.length ? (
          <ul className="grid gap-5 xl:grid-cols-2">
            {waiting.map((board) => (
              <Waiting key={board.id} board={board} designer={claimed.get(board.businessId)} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No design waits for a choice">Before a site is built, its three designs land here. The build goes on when you or Boris choose one.</EmptyState>
        )}
      </Section>
      {decided.length > 0 && (
        <Section title="Chosen" count={decided.length}>
          <Agreement decided={await decisionsOf(decided)} />
          <Card>
            <ul className="divide-ink/8 divide-y">
              {decided.slice(0, RECENT).map((board) => (
                <Chosen key={board.id} board={board} by={deciderOf(board.chosenBy ?? "").name} />
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </>
  );
}
