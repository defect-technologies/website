import { requireFounder } from "@/server/auth/session";
import { ArrowCounterClockwise, CaretRight, Prohibit } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { AddDesignerForm } from "@/components/admin/designers/DesignerForms";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, Section } from "@/components/admin/ui";
import { THEIR_TURN } from "@/lib/designerWork";
import { FOUNDERS, founderSlug } from "@/lib/founders";
import { formatCents } from "@/lib/settleUp";
import type { Designer } from "@/server/db/schema";
import { ledgerOf } from "@/server/designers/pay";
import { allDesigners } from "@/server/designers/people";
import { designerBusinesses } from "@/server/designers/work";
import { setDesignerActiveAction } from "./actions";

export const metadata: Metadata = { title: "Designers" };

type Summary = { designer: Designer; businesses: number; waiting: number; clients: number; owedCents: number };

async function summaryOf(designer: Designer): Promise<Summary> {
  const businesses = await designerBusinesses(designer.id);
  const ledger = await ledgerOf(designer.id, businesses);
  return {
    designer,
    businesses: businesses.length,
    waiting: businesses.filter((business) => THEIR_TURN.includes(business.status)).length,
    clients: ledger.earned.length,
    owedCents: ledger.owedCents,
  };
}

function ActiveSwitch({ designer }: { designer: Designer }) {
  const active = !designer.deactivatedAt;
  return (
    <form action={setDesignerActiveAction}>
      <input type="hidden" name="id" value={designer.id} />
      <input type="hidden" name="active" value={String(!active)} />
      <SubmitButton size="sm" variant="ghost" icon={active ? <Prohibit size={16} aria-hidden="true" /> : <ArrowCounterClockwise size={16} aria-hidden="true" />}>
        {active ? "Deactivate" : "Let back in"}
      </SubmitButton>
    </form>
  );
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function DesignerRow({ summary }: { summary: Summary }) {
  const { designer } = summary;
  const active = !designer.deactivatedAt;
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${active ? "" : "bg-paper-shade/40"}`}>
      <Link href={`/admin/setup/designers/${designer.id}`} className={ROW_LINK}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate font-medium ${active ? "" : "text-ink-soft"}`}>{designer.name}</span>
          <span className="text-ink-faint truncate text-sm">{active ? designer.email : `Deactivated, ${designer.email}`}</span>
        </span>
        <span className="text-ink-soft flex flex-col items-end text-sm tabular-nums">
          <span>{plural(summary.businesses, "design", "designs")}, {plural(summary.clients, "sign-up", "sign-ups")}</span>
          {summary.waiting > 0 && <span className="text-ink font-medium">{summary.waiting} waiting on them</span>}
        </span>
        <span className={`w-24 text-right font-semibold tabular-nums ${summary.owedCents > 0 ? "text-ink" : "text-ink-faint"}`} title="Owed">
          {formatCents(Math.max(summary.owedCents, 0))}
          <span className="sr-only"> owed</span>
        </span>
        <CaretRight size={16} weight="bold" className="text-ink-faint shrink-0" aria-hidden="true" />
      </Link>
      <ActiveSwitch designer={designer} />
    </li>
  );
}

const ROW_LINK = "hover:bg-paper-shade/50 focus-visible:outline-ink -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 focus-visible:outline-2";

/** A founder decides designs too. Their row opens their lessons and notes; a founder is never paid. */
function FounderRow({ founder }: { founder: (typeof FOUNDERS)[number] }) {
  return (
    <li className="flex items-center px-5 py-3">
      <Link href={`/admin/setup/designers/founder/${founderSlug(founder.name)}`} className={ROW_LINK}>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{founder.name}</span>
          <span className="text-ink-faint truncate text-sm">Founder, {founder.email}</span>
        </span>
        <CaretRight size={16} weight="bold" className="text-ink-faint shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** The founders, then the student designers who choose designs and review builds in their place, and what each is owed. */
export default async function DesignersPage() {
  await requireFounder();
  const summaries = await Promise.all((await allDesigners()).map(summaryOf));
  return (
    <>
      <PageHeader title="Designers" />
      <Section title="Add a designer">
        <AddDesignerForm />
      </Section>
      <Section title="Designers" count={FOUNDERS.length + summaries.length}>
        <Card>
          <ul className="divide-ink/8 divide-y">
            {FOUNDERS.map((founder) => (
              <FounderRow key={founder.email} founder={founder} />
            ))}
            {summaries.map((summary) => (
              <DesignerRow key={summary.designer.id} summary={summary} />
            ))}
          </ul>
        </Card>
        {summaries.length === 0 && <EmptyState title="No student designers yet">A designer signs in with Google, takes waiting designs, chooses one and reviews the build. They earn one month of the fee for each design a business signs up for.</EmptyState>}
      </Section>
    </>
  );
}
