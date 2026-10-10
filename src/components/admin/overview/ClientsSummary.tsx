import type { Integration } from "@/server/integrations/result";
import type { StripeSummary } from "@/server/integrations/stripe";
import IntegrationPanel from "../IntegrationPanel";
import { SyncPaymentsButton } from "../ProjectControls";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Monthly revenue from Stripe, and a manual check for payments between the half-hourly syncs. */
export default function ClientsSummary({ money }: { money: Integration<StripeSummary> }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <IntegrationPanel result={money}>
        {(data) => (
          <p className="tabular-nums">
            <span className="text-xl font-semibold">{dollars.format(data.monthlyRevenue)}</span>
            <span className="text-ink-faint"> a month from {data.active} subscriptions</span>
          </p>
        )}
      </IntegrationPanel>
      <SyncPaymentsButton />
    </div>
  );
}
