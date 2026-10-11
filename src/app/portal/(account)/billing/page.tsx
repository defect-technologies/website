import { ArrowSquareOut, CheckCircle, ClockCountdown, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { Card, Notice } from "@/components/admin/ui";
import PortalShell from "@/components/portal/PortalShell";
import { clientPlan, type ClientPlan } from "@/server/integrations/stripe";
import { portalContext } from "@/server/portal/context";

export const metadata: Metadata = { title: "Billing" };

const PROBLEMS: Record<string, string> = {
  missing: "We couldn't find a plan for this site. Email hello@defect.tech and we'll sort it out.",
  failed: "Your billing page didn't open. Try again in a minute, or email hello@defect.tech.",
};

const longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0 })}`;

function PlanStatus({ plan }: { plan: ClientPlan }) {
  const when = plan.periodEnd ? longDate.format(plan.periodEnd) : null;
  let line: { icon: ReactNode; text: string; tone: string };
  if (plan.status === "past_due" || plan.status === "unpaid") {
    line = { icon: <WarningCircle size={20} weight="fill" aria-hidden="true" />, text: "Your last payment didn't go through. Update your card to keep your site online.", tone: "text-bad" };
  } else if (plan.ending || plan.status === "canceled") {
    line = { icon: <ClockCountdown size={20} weight="fill" aria-hidden="true" />, text: when ? `Cancelled. Your plan ends on ${when}.` : "Cancelled.", tone: "text-warn" };
  } else {
    line = { icon: <CheckCircle size={20} weight="fill" aria-hidden="true" />, text: when ? `Active. Next charge on ${when}.` : "Active.", tone: "text-good" };
  }
  return <p className={`flex items-start gap-2 ${line.tone}`}>{line.icon}<span>{line.text}</span></p>;
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ site?: string; problem?: string }> }) {
  const query = await searchParams;
  const context = await portalContext(query.site);
  const { site } = context;
  const plan = site.stripeCustomerId ? await clientPlan(site.stripeCustomerId) : null;
  if (plan && plan.state !== "ok") console.error(`[portal] Plan for ${site.slug} unavailable`, plan);
  const current = plan?.state === "ok" ? plan.data : null;

  return (
    <PortalShell context={context} path="/portal/billing">
      <h1 className="text-3xl font-semibold sm:text-4xl">Billing</h1>
      {query.problem && PROBLEMS[query.problem] && <Notice tone="bad">{PROBLEMS[query.problem]}</Notice>}
      <Card className="flex max-w-2xl flex-col gap-6 p-6 sm:p-8">
        {current ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-ink-soft font-medium">Your plan</h2>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-6xl leading-none font-black tabular-nums">{dollars(current.cents)}</span>
              <span className="text-ink-soft text-lg">a {current.interval}</span>
            </p>
            <PlanStatus plan={current} />
          </div>
        ) : (
          <p className="text-ink-soft text-pretty">
            {site.stripeCustomerId ? "Your plan details can't be loaded right now." : "We don't have a plan on file for this site."} Email
            hello@defect.tech and we&apos;ll help.
          </p>
        )}
        {site.stripeCustomerId && (
          <div className="border-ink/8 flex flex-col items-start gap-3 border-t pt-6">
            {/* A plain link, not next/link: prefetching would create a Stripe session in the background. */}
            <a href={`/portal/billing/${site.slug}`} className={buttonClasses("solid")}>
              Manage billing
              <ArrowSquareOut size={20} aria-hidden="true" />
            </a>
            <p className="text-ink-faint text-sm">Opens Stripe, where you can update your card, see past invoices or cancel.</p>
          </div>
        )}
      </Card>
    </PortalShell>
  );
}
