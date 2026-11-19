import type { Metadata } from "next";
import { EarnedList, OwedFigure, PaymentList } from "@/components/admin/designers/PayParts";
import { PageHeader } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { requireDesigner } from "@/server/auth/designerSession";
import { ledgerOf } from "@/server/designers/pay";

export const metadata: Metadata = { title: "Pay" };

/** What the designer earned (one month of the fee for each design of theirs a business signed up for), was paid, and is owed. */
export default async function DesignerPayPage() {
  const designer = await requireDesigner();
  const ledger = await ledgerOf(designer.id);
  return (
    <>
      <PageHeader title="Pay" />
      <OwedFigure ledger={ledger} />
      {!ledger.earned.length && <p className="text-ink-soft max-w-prose text-pretty">You earn one month of a client&rsquo;s fee when a business signs up for a design of yours. The founders pay you by Zelle.</p>}
      <EarnedList earned={ledger.earned} />
      <PaymentList payments={ledger.payments} recorderName={founderName} />
    </>
  );
}
