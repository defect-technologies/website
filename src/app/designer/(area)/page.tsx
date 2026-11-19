import { Swatches } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import { TurnList, UpNext } from "@/components/admin/turn/TurnParts";
import { PageHeader, Section } from "@/components/admin/ui";
import { requireDesigner } from "@/server/auth/designerSession";
import { pool } from "@/server/designers/claims";
import { designerTurns } from "@/server/designers/work";

export const metadata: Metadata = { title: "Your turn" };

async function NothingWaits() {
  const open = (await pool()).length;
  return (
    <EmptyState
      title="Nothing waits for you"
      action={
        open > 0 && (
          <ButtonLink href="/designer/pool" variant="solid" icon={<Swatches size={18} aria-hidden="true" />} className="mt-2">
            Take a business
          </ButtonLink>
        )
      }
    >
      {open > 0 ? `${open} ${open === 1 ? "business waits" : "businesses wait"} for a designer.` : "No business waits for a designer right now. New designs arrive as the runner draws them."}
    </EmptyState>
  );
}

/** What waits for this designer: designs to choose on their businesses, then built sites to review. */
export default async function DesignerTurnPage() {
  const designer = await requireDesigner();
  const [next, ...rest] = await designerTurns(designer.id);
  const designs = rest.filter((turn) => turn.kind === "design");
  const sites = rest.filter((turn) => turn.kind !== "design");
  return (
    <>
      <PageHeader title="Your turn" />
      {next ? <UpNext turn={next} /> : <NothingWaits />}
      {designs.length > 0 && (
        <Section title="Designs to choose" count={designs.length}>
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
