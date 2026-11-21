import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Section, StatusMark, When } from "@/components/admin/ui";
import KnifeStroke from "../KnifeStroke";
import { formatCents } from "@/lib/settleUp";
import type { DesignerPayment } from "@/server/db/schema";
import type { Earning } from "@/server/designers/pay";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const paidOn = (date: string) => day.format(new Date(`${date}T00:00:00Z`));

/** What we still owe a designer, big. Nothing owed reads as all paid, and `children` (the way to pay) shows only while something is. */
export function BalanceCard({ title, owedCents, children }: { title: string; owedCents: number; children?: ReactNode }) {
  const outstanding = Math.max(owedCents, 0);
  return (
    <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{title}</p>
        <p className="relative isolate w-fit">
          {outstanding > 0 && <KnifeStroke className="text-vermilion/25 absolute -inset-x-3 inset-y-1 -z-10 h-[calc(100%-0.5rem)] w-[calc(100%+1.5rem)]" />}
          <span className={`font-display text-6xl leading-none font-black tabular-nums ${outstanding > 0 ? "" : "text-ink-faint"}`}>{formatCents(outstanding)}</span>
        </p>
        {outstanding === 0 && <StatusMark icon={CheckCircle} tone="good" label="All paid" />}
      </div>
      {outstanding > 0 && children}
    </Card>
  );
}

/** One month of each client's fee, for each design of theirs a business signed up for, and whether it was paid out. */
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
                  Signed up <When date={earning.paidAt} />
                </span>
              </span>
              <span className="flex flex-col items-end tabular-nums">
                <span className={`font-semibold ${earning.settled ? "text-ink-soft" : "text-good"}`}>{formatCents(earning.cents)}</span>
                <span className="text-ink-faint text-sm">{earning.settled ? "Paid" : "Owed"}</span>
              </span>
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
