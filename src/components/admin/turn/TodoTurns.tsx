import WaitingActions from "@/components/admin/designs/WaitingActions";
import { Section } from "@/components/admin/ui";
import type { Turn } from "@/lib/turn";
import { TurnList, UpNext } from "./TurnParts";

/** What waits for a founder's taste, at the top of To do: the item to take now, big, then the rest by kind. */
export default function TodoTurns({ turns }: { turns: Turn[] }) {
  const [next, ...rest] = turns;
  if (!next) return null;
  const designs = rest.filter((turn) => turn.kind === "design");
  const sites = rest.filter((turn) => turn.kind !== "design");
  const designsWaiting = turns.filter((turn) => turn.kind === "design").length;
  return (
    <>
      <UpNext turn={next} />
      {designs.length > 0 && (
        <Section title="Designs to choose" count={designs.length} action={designsWaiting > 1 ? <WaitingActions count={designsWaiting} /> : undefined}>
          <TurnList turns={designs} />
        </Section>
      )}
      {sites.length > 0 && (
        <Section title="Sites to check" count={sites.length}>
          <TurnList turns={sites} />
        </Section>
      )}
    </>
  );
}
