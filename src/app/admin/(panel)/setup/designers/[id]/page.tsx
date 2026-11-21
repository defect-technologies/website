import { CheckCircle, Prohibit } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import SubmitButton from "@/components/admin/SubmitButton";
import { BuildVerdictList, DecisionList } from "@/components/admin/designers/Oversight";
import { BalanceCard, PaymentList } from "@/components/admin/designers/PayParts";
import WorkList from "@/components/admin/designers/WorkList";
import { PageHeader, StatusMark } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { requireFounder } from "@/server/auth/session";
import { buildVerdictsBy, designDecisionsBy } from "@/server/designers/oversight";
import { ledgerOf } from "@/server/designers/pay";
import { designerById } from "@/server/designers/people";
import { designerBusinesses } from "@/server/designers/work";
import { settleDesignerAction } from "../actions";

export const metadata: Metadata = { title: "Designer" };

const deactivatedOn = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** One designer for the founders: what we owe them, their designs, the decisions and reviews they made, and what was paid. */
export default async function DesignerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const designer = await designerById((await params).id);
  if (!designer) notFound();
  const businesses = await designerBusinesses(designer.id);
  const [ledger, decisions, verdicts] = await Promise.all([ledgerOf(designer.id, businesses), designDecisionsBy(designer.email), buildVerdictsBy(designer.email)]);
  return (
    <>
      <PageHeader title={designer.name}>
        {designer.deactivatedAt && <StatusMark icon={Prohibit} label={`Deactivated ${deactivatedOn.format(designer.deactivatedAt)}`} />}
        <ButtonLink href="/admin/setup/designers" variant="ghost">
          All designers
        </ButtonLink>
      </PageHeader>
      <BalanceCard title={`Owed to ${designer.name}`} owedCents={ledger.owedCents}>
        <form action={settleDesignerAction}>
          <input type="hidden" name="id" value={designer.id} />
          <SubmitButton variant="solid" icon={<CheckCircle size={18} weight="bold" aria-hidden="true" />}>
            Mark sent by Zelle
          </SubmitButton>
        </form>
      </BalanceCard>
      {businesses.length ? <WorkList businesses={businesses} hrefFor={(business) => `/admin/sites/${business.id}`} settled={ledger.settled} /> : <EmptyState title={`${designer.name} has no designs`} />}
      <DecisionList decisions={decisions} />
      <BuildVerdictList verdicts={verdicts} />
      <PaymentList payments={ledger.payments} recorderName={founderName} />
    </>
  );
}
