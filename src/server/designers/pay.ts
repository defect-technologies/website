import "server-only";
import { desc, eq } from "drizzle-orm";
import { owedCents, paidEarnings } from "@/lib/designerWork";
import { db } from "../db/client";
import { designerPayments, type DesignerPayment } from "../db/schema";
import { type DesignerBusiness, designerBusinesses } from "./work";

export type Earning = { businessId: string; businessName: string; paidAt: Date | null; cents: number; settled: boolean };

export type Ledger = { earned: Earning[]; payments: DesignerPayment[]; earnedCents: number; paidCents: number; owedCents: number; settled: Set<string> };

export async function paymentsTo(designerId: string): Promise<DesignerPayment[]> {
  return (await db()).select().from(designerPayments).where(eq(designerPayments.designerId, designerId)).orderBy(desc(designerPayments.paidOn), desc(designerPayments.recordedAt));
}

export async function recordPayment(payment: { designerId: string; amountCents: number; paidOn: string; note: string; recordedBy: string }): Promise<DesignerPayment> {
  const [row] = await (await db()).insert(designerPayments).values(payment).returning();
  return row;
}

/** One month of each client's fee, for every design of theirs a business signed up for, the newest first. */
export function earningsFrom(businesses: DesignerBusiness[], payments: DesignerPayment[]): Earning[] {
  const earned = businesses.filter((business) => business.earnedCents > 0).map((business) => ({ businessId: business.id, businessName: business.businessName, paidAt: business.paidAt, cents: business.earnedCents }));
  const settled = paidEarnings(earned, payments);
  return earned.map((earning) => ({ ...earning, settled: settled.has(earning.businessId) })).sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0));
}

/** What a designer earned, what they were paid, and what they are owed: always worked out, never stored. */
export async function ledgerOf(designerId: string, businesses?: DesignerBusiness[]): Promise<Ledger> {
  const [own, payments] = await Promise.all([businesses ?? designerBusinesses(designerId), paymentsTo(designerId)]);
  const earned = earningsFrom(own, payments);
  const owed = owedCents(earned, payments);
  const earnedCents = earned.reduce((total, entry) => total + entry.cents, 0);
  const settled = new Set(earned.filter((earning) => earning.settled).map((earning) => earning.businessId));
  return { earned, payments, earnedCents, paidCents: earnedCents - owed, owedCents: owed, settled };
}
