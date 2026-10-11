import "server-only";
import { eq } from "drizzle-orm";
import { FOUNDERS } from "@/lib/founders";
import { db } from "../db/client";
import { settings } from "../db/schema";
import { emailFounders } from "../flags/notify";
import { cycleCharges } from "../integrations/vercelBilling";
import { addExpense } from "./expenses";

/** Vercel Pro renews on the 8th (the "Vercel Pro" repeating expense), so each billing cycle runs from the 8th to the 8th. */
const CYCLE_DAY = 8;
const RECORDED_KEY = "expense.vercel-usage";
const PAYER = FOUNDERS.find((founder) => founder.name === "Brendan")!.email;

const money = (amount: number) => `$${amount.toFixed(2)}`;
const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** The billing cycle that most recently ended, as of `now`. */
function lastCycle(now: Date): { from: Date; to: Date } {
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), CYCLE_DAY));
  if (to > now) to.setUTCMonth(to.getUTCMonth() - 1);
  const from = new Date(to);
  from.setUTCMonth(from.getUTCMonth() - 1);
  return { from, to };
}

async function recordedCycle(): Promise<string> {
  const [row] = await (await db()).select().from(settings).where(eq(settings.key, RECORDED_KEY));
  return (row?.value as string | undefined) ?? "";
}

async function saveRecordedCycle(cycle: string) {
  await (await db())
    .insert(settings)
    .values({ key: RECORDED_KEY, value: cycle })
    .onConflictDoUpdate({ target: settings.key, set: { value: cycle, updatedAt: new Date() } });
}

export type UsageRecord = { cycle: string; usage: number; credits: number; overage: number; recorded: boolean };

/**
 * After each Vercel billing cycle, adds what its usage cost beyond Pro's $20 credit to Expenses, paid by Brendan,
 * whose card Vercel charges. The plan itself is already the "Vercel Pro" repeating expense, so a cycle that
 * stayed inside the credit adds nothing.
 */
export async function recordVercelUsage(now = new Date()): Promise<UsageRecord> {
  const { from, to } = lastCycle(now);
  const cycle = from.toISOString().slice(0, 10);
  const charges = await cycleCharges(from, to);
  const result = { cycle, usage: charges.usage, credits: charges.credits, overage: charges.overage, recorded: false };
  if (charges.overage < 0.01 || (await recordedCycle()) === cycle) return result;
  const last = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const span = `${shortDate.format(from)} to ${shortDate.format(last)}`;
  await addExpense({
    spentOn: to.toISOString().slice(0, 10),
    item: `Vercel usage over the plan's credit, ${span}`,
    amountCents: Math.round(charges.overage * 100),
    paidBy: PAYER,
    createdBy: "bot:vercel-usage",
  });
  await saveRecordedCycle(cycle);
  await emailFounders(
    `Vercel usage cost ${money(charges.overage)} over the plan's credit`,
    [
      `Vercel usage from ${span} came to ${money(charges.usage)}, ${money(charges.overage)} more than Pro's credit covers. It's been added to Expenses, paid by Brendan, dated ${to.toISOString().slice(0, 10)}.`,
      "",
      "Biggest items:",
      ...charges.services.slice(0, 6).map((service) => `- ${service.name}: ${money(service.cost)}`),
      "",
      charges.credits < 0 ? `Vercel listed ${money(-charges.credits)} of credits.` : "Vercel didn't list the credit, so the documented $20 was taken off.",
      "Check it against Vercel's invoice under Settings, Billing.",
    ].join("\n"),
  );
  return { ...result, recorded: true };
}
