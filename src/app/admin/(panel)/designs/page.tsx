import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { BoardPicture, Letter } from "@/components/admin/designs/parts";
import { Card, PageHeader, Section, When } from "@/components/admin/ui";
import { pickAgreement } from "@/lib/boards";
import { founderName } from "@/lib/founders";
import { requireFounder } from "@/server/auth/session";
import { boardsDecided, boardsWaiting, decisionOf, type BoardWithLead } from "@/server/boards/store";

export const metadata: Metadata = { title: "Designs" };

const RECENT = 12;

function Waiting({ board }: { board: BoardWithLead }) {
  return (
    <li>
      <Link href={`/admin/designs/${board.id}`} className="bg-surface shadow-card hover:shadow-card focus-visible:outline-ink ease-knife flex flex-col gap-4 rounded-2xl p-4 transition-[scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-xl font-semibold">{board.businessName}</span>
          <span className="text-ink-faint shrink-0 text-sm">
            <When date={board.createdAt} />
          </span>
        </span>
        <span className="grid grid-cols-3 gap-3">
          {board.options.map((option) => (
            <BoardPicture key={option.letter} src={option.pictures.desktop} alt={`Option ${option.letter.toUpperCase()}, ${option.name}`} className="aspect-[16/10] rounded-lg object-cover object-top" />
          ))}
        </span>
      </Link>
    </li>
  );
}

function Chosen({ board }: { board: BoardWithLead }) {
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
          {founderName(board.chosenBy ?? "")}, <When date={board.chosenAt} />
        </span>
      </Link>
    </li>
  );
}

/** A sentence only once the system has made picks: how often its own guess was the option a founder chose. */
function Agreement({ decided }: { decided: BoardWithLead[] }) {
  const { matched, of } = pickAgreement(decided.map(decisionOf).filter((decision) => decision !== null));
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
  return (
    <>
      <PageHeader title="Designs" />
      <Section title="Waiting for a choice" count={waiting.length}>
        {waiting.length ? (
          <ul className="grid gap-5 xl:grid-cols-2">
            {waiting.map((board) => (
              <Waiting key={board.id} board={board} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No design waits for a choice">Before a site is built, its three designs land here. The build goes on when you or Boris choose one.</EmptyState>
        )}
      </Section>
      {decided.length > 0 && (
        <Section title="Chosen" count={decided.length}>
          <Agreement decided={decided} />
          <Card>
            <ul className="divide-ink/8 divide-y">
              {decided.slice(0, RECENT).map((board) => (
                <Chosen key={board.id} board={board} />
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </>
  );
}
