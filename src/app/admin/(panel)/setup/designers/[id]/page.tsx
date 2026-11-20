import { requireFounder } from "@/server/auth/session";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import { RecordPaymentForm } from "@/components/admin/designers/DesignerForms";
import { BuildVerdictList, DecisionList } from "@/components/admin/designers/Oversight";
import { EarnedList, OwedFigure, PaymentList } from "@/components/admin/designers/PayParts";
import WorkList from "@/components/admin/designers/WorkList";
import ActivitySheet from "@/components/admin/overview/ActivitySheet";
import { Notice, PageHeader, Section, When } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { todayInPacific } from "@/lib/settleUp";
import { buildVerdictsBy, designDecisionsBy } from "@/server/designers/oversight";
import { ledgerOf } from "@/server/designers/pay";
import { designerById } from "@/server/designers/people";
import { designerBusinesses } from "@/server/designers/work";
import { recentActivity } from "@/server/overview";

export const metadata: Metadata = { title: "Designer" };

const ACTIVITY_SHOWN = 50;

/** One designer's work for the founders: their designs, decisions with their words, reviews, pay and activity. */
export default async function DesignerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFounder();
  const designer = await designerById((await params).id);
  if (!designer) notFound();
  const businesses = await designerBusinesses(designer.id);
  const [ledger, decisions, verdicts, activity] = await Promise.all([ledgerOf(designer.id, businesses), designDecisionsBy(designer.email), buildVerdictsBy(designer.email), recentActivity(ACTIVITY_SHOWN, designer.email)]);
  return (
    <>
      <PageHeader title={designer.name}>
        <ButtonLink href="/admin/setup/designers" variant="ghost">
          All designers
        </ButtonLink>
      </PageHeader>
      {designer.deactivatedAt && (
        <Notice tone="warn">
          {founderName(designer.deactivatedBy)} deactivated {designer.name} <When date={designer.deactivatedAt} />. They can&rsquo;t sign in. Designs they hadn&rsquo;t finished went back to the pool, and the ones they finished still earn them their share.
        </Notice>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <OwedFigure ledger={ledger} />
        <RecordPaymentForm designerId={designer.id} today={todayInPacific()} owedCents={ledger.owedCents} />
      </div>
      {businesses.length ? (
        <WorkList businesses={businesses} hrefFor={(business) => `/admin/sites/${business.id}`} settled={ledger.settled} />
      ) : (
        <EmptyState title={`${designer.name} has no designs`}>Designs they take from the pool show here, with where each stands.</EmptyState>
      )}
      <DecisionList decisions={decisions} />
      <BuildVerdictList verdicts={verdicts} />
      <EarnedList earned={ledger.earned} hrefFor={(earning) => `/admin/sites/${earning.businessId}`} />
      <PaymentList payments={ledger.payments} recorderName={founderName} />
      {activity.length > 0 && (
        <Section title="Activity" count={activity.length}>
          <ActivitySheet rows={activity} />
        </Section>
      )}
    </>
  );
}
