import "server-only";
import { env } from "../env";

type Charge = { BilledCost: number | string; ChargeCategory: string; ServiceName: string };

/** Pro's usage credit each billing cycle, used when Vercel's charges don't list it themselves. */
const PRO_USAGE_CREDIT = 20;

export type CycleCharges = {
  /** Usage before credits, in dollars. */
  usage: number;
  /** Credits applied, as a negative number, when Vercel lists them. */
  credits: number;
  /** The plan and anything else that isn't metered usage: subscriptions, adjustments, tax. */
  other: number;
  /** What the cycle's usage cost beyond Pro's credit. */
  overage: number;
  services: { name: string; cost: number }[];
};

/** Vercel's charges between two instants, from the billing API's FOCUS rows (one JSON object per line). */
async function charges(from: Date, to: Date): Promise<Charge[]> {
  const { token, teamId } = env.vercel();
  const params = new URLSearchParams({ teamId, from: from.toISOString(), to: to.toISOString() });
  const response = await fetch(`https://api.vercel.com/v1/billing/charges?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Vercel billing answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return (await response.text())
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Charge);
}

const cost = (charge: Charge) => Number(charge.BilledCost) || 0;
const total = (rows: Charge[]) => rows.reduce((sum, row) => sum + cost(row), 0);

function byService(rows: Charge[]) {
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.ServiceName, (sums.get(row.ServiceName) ?? 0) + cost(row));
  return [...sums].map(([name, amount]) => ({ name, cost: amount })).filter((service) => service.cost >= 0.005).sort((a, b) => b.cost - a.cost);
}

/**
 * One billing cycle's usage against Pro's credit. If Vercel lists the credit as Credit rows, those are used;
 * otherwise the documented $20 is taken off.
 */
export async function cycleCharges(from: Date, to: Date): Promise<CycleCharges> {
  const rows = await charges(from, to);
  const usageRows = rows.filter((row) => row.ChargeCategory === "Usage");
  const usage = total(usageRows);
  const credits = total(rows.filter((row) => row.ChargeCategory === "Credit"));
  const other = total(rows.filter((row) => row.ChargeCategory !== "Usage" && row.ChargeCategory !== "Credit"));
  const overage = Math.max(0, credits < 0 ? usage + credits : usage - PRO_USAGE_CREDIT);
  return { usage, credits, other, overage, services: byService(usageRows) };
}
