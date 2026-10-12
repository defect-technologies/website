import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PaintedHeadline from "@/components/PaintedHeadline";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import SectionHeading from "@/components/welcome/SectionHeading";
import SignUpSteps from "@/components/welcome/SignUpSteps";
import { SIGNED_UP } from "@/content/headlines";
import { afterSignUp } from "@/content/welcome";
import { launchDomainOf } from "@/server/integrations/domain";
import { finishWelcomeCheckout } from "@/server/integrations/stripe";
import { businessByLinkCode } from "@/server/leads/businesses";

export const metadata: Metadata = { title: "You're signed up", robots: { index: false, follow: false } };

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ session_id?: string }> };

/** Stripe sends the owner here after checkout. The payment is recorded now rather than at the next half-hourly sync. */
export default async function SignedUpPage({ params, searchParams }: Props) {
  const [{ code }, { session_id: sessionId = "" }] = await Promise.all([params, searchParams]);
  const business = await businessByLinkCode(code);
  if (!business) notFound();
  const status = await finishWelcomeCheckout(sessionId, business);
  if (status !== "complete" && !business.paidAt) redirect(`/welcome/${code}#checkout`);
  return (
    <>
      <SiteNav page="welcome" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-32 pb-[16vh] sm:px-8">
        <div className="flex flex-col gap-6">
          <PaintedHeadline as="h1" headline={SIGNED_UP} style={{ fontSize: "clamp(3.5rem, 10vw, 8rem)" }} />
          <p className="text-ink-soft max-w-[40ch] text-xl leading-relaxed text-pretty">
            Thank you for choosing us for <span className="text-ink font-semibold">{business.businessName}</span>. A welcome email is on its way, and we&rsquo;ll follow up within a
            business day.
          </p>
        </div>
        <section className="flex flex-col gap-10" aria-labelledby="next">
          <SectionHeading id="next">What happens next</SectionHeading>
          <SignUpSteps steps={afterSignUp(launchDomainOf(business))} current={0} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
