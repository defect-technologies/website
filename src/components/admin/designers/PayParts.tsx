import Link from "next/link";
import { Card, KeyValue, Section, When } from "@/components/admin/ui";
import { formatCents } from "@/lib/settleUp";
import type { DesignerPayment } from "@/server/db/schema";
import type { Earning, Ledger } from "@/server/designers/pay";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const paidOn = (date: string) => day.format(new Date(`${date}T00:00:00Z`));

/** What is owed, big, with what was earned and paid under it. Paid past what was earned reads as paid ahead. */
export function OwedFigure({ ledger }: { ledger: Ledger }) {
  const ahead = ledger.owedCents < 0;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <span className="text-ink-soft text-sm">{ahead ? "Paid ahead" : "Owed"}</span>
        <span className={`font-display text-5xl leading-none font-black tabular-nums ${ledger.owedCents > 0 ? "text-ink" : "text-ink-soft"}`}>{formatCents(Math.abs(ledger.owedCents))}</span>
      </div>
      <KeyValue
        rows={[
          ["Earned", `${formatCents(ledger.earnedCents)} from ${ledger.earned.length} ${ledger.earned.length === 1 ? "client" : "clients"}`],
          ["Paid", formatCents(ledger.paidCents)],
        ]}
      />
    </Card>
  );
}

/** One month of each client's fee, for each business of theirs that became a client. */
export function EarnedList({ earned, hrefFor }: { earned: Earning[]; hrefFor?: (earning: Earning) => string }) {
  if (!earned.length) return null;
  return (
    <Section title="Earned" count={earned.length}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {earned.map((earning) => (
            <li key={earning.businessId} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <span className="flex min-w-0 flex-col">
                {hrefFor ? (
                  <Link href={hrefFor(earning)} className="truncate font-medium hover:underline">
                    {earning.businessName}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{earning.businessName}</span>
                )}
                <span className="text-ink-faint text-sm">
                  Became a client <When date={earning.paidAt} />
                </span>
              </span>
              <span className="text-good font-semibold tabular-nums">{formatCents(earning.cents)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}

/** Every payment a founder recorded, the newest first, with who recorded it and their note. */
export function PaymentList({ payments, recorderName }: { payments: DesignerPayment[]; recorderName: (email: string) => string }) {
  if (!payments.length) return null;
  return (
    <Section title="Payments" count={payments.length}>
      <Card>
        <ul className="divide-ink/8 divide-y">
          {payments.map((payment) => (
            <li key={payment.id} className="flex items-baseline justify-between gap-4 px-5 py-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{paidOn(payment.paidOn)}</span>
                <span className="text-ink-faint text-sm">Recorded by {recorderName(payment.recordedBy)}</span>
                {payment.note && <span className="text-ink-soft text-sm text-pretty">{payment.note}</span>}
              </span>
              <span className="font-semibold tabular-nums">{formatCents(payment.amountCents)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
