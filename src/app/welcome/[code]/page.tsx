import { ArrowDown, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buttonClasses, ButtonLink } from "@/components/Button";
import PaintedHeadline from "@/components/PaintedHeadline";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { Card, Notice } from "@/components/admin/ui";
import { IncludedList, QuestionList } from "@/components/welcome/PlanDetails";
import PlanCheckout from "@/components/welcome/PlanCheckout";
import SectionHeading from "@/components/welcome/SectionHeading";
import SignUpSteps from "@/components/welcome/SignUpSteps";
import SitePreviewFrame from "@/components/welcome/SitePreviewFrame";
import WelcomeVideo from "@/components/welcome/WelcomeVideo";
import { WELCOME } from "@/content/headlines";
import { afterSignUp, WELCOME_VIDEO } from "@/content/welcome";
import { REGULAR_MONTHLY_PRICE } from "@/lib/emailTemplate";
import type { Business } from "@/server/db/schema";
import { env } from "@/server/env";
import { launchDomainOf } from "@/server/integrations/domain";
import { monthlyPriceOf } from "@/server/integrations/stripe";
import { businessByLinkCode } from "@/server/leads/businesses";

type Props = { params: Promise<{ code: string }> };

const SECTION = "mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-[10vh] sm:px-8";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const business = await businessByLinkCode((await params).code);
  return {
    title: business ? `${business.businessName}'s new website` : "defect.tech",
    robots: { index: false, follow: false },
  };
}

function Hero({ business, price }: { business: Business; price: number }) {
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-32 pb-[8vh] sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col gap-8">
        <PaintedHeadline as="h1" headline={WELCOME} style={{ fontSize: "clamp(3.5rem, 9vw, 7rem)" }} />
        <p className="text-ink-soft max-w-[34ch] text-xl leading-relaxed text-pretty">
          For ${price} a month, we&rsquo;ll host <span className="text-ink font-semibold">{business.businessName}</span>&rsquo;s new website and keep it up to date.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="#checkout" icon={<ArrowDown size={20} weight="bold" aria-hidden="true" />}>
            Start my plan
          </ButtonLink>
          <a href={business.previewUrl} target="_blank" rel="noopener" className={buttonClasses("soft")}>
            Open my new website
            <ArrowUpRight size={20} weight="bold" aria-hidden="true" />
          </a>
        </div>
      </div>
      <SitePreviewFrame previewUrl={business.previewUrl} businessName={business.businessName} domain={launchDomainOf(business) ?? `${business.slug}.defect.tech`} />
    </section>
  );
}

function PriceSummary({ price }: { price: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2">
        <span className="font-display text-ink text-8xl leading-none font-black tabular-nums">${price}</span>
        <span className="text-ink-soft text-xl">a month</span>
      </p>
      {price < REGULAR_MONTHLY_PRICE && <p className="text-ink-soft text-lg text-pretty">The plan is usually ${REGULAR_MONTHLY_PRICE} a month. Your price stays the same for as long as you&rsquo;re with us.</p>}
    </div>
  );
}

function CheckoutArea({ business, code }: { business: Business; code: string }) {
  const publishableKey = env.stripePublishableKey();
  if (business.paidAt) {
    return (
      <Card className="flex flex-col gap-3 p-6 sm:p-8">
        <p className="text-ink text-xl font-semibold">You&rsquo;ve signed up.</p>
        <p className="text-ink-soft text-lg text-pretty">We&rsquo;ll email you within a business day about anything you&rsquo;d like changed. If you have questions before then, write to hello@defect.tech.</p>
      </Card>
    );
  }
  if (!publishableKey) {
    return (
      <Notice tone="warn">
        Online checkout isn&rsquo;t working right now. If you email hello@defect.tech, we&rsquo;ll sign you up.
      </Notice>
    );
  }
  return <PlanCheckout code={code} publishableKey={publishableKey} suggestedEmail={business.ownerEmail || business.email} />;
}

export default async function WelcomePage({ params }: Props) {
  const { code } = await params;
  const business = await businessByLinkCode(code);
  if (!business?.previewUrl) notFound();
  const price = monthlyPriceOf(business);
  return (
    <>
      <SiteNav page="welcome" />
      <main>
        <Hero business={business} price={price} />
        {WELCOME_VIDEO && (
          <section className={SECTION} aria-labelledby="video">
            <SectionHeading id="video">How defect.tech works</SectionHeading>
            <WelcomeVideo video={WELCOME_VIDEO} />
          </section>
        )}
        <section className={SECTION} aria-labelledby="after">
          <SectionHeading id="after">After you sign up</SectionHeading>
          <SignUpSteps steps={afterSignUp(launchDomainOf(business))} />
        </section>
        <section className={SECTION} aria-labelledby="plan">
          <SectionHeading id="plan">Your plan</SectionHeading>
          <IncludedList />
        </section>
        <section className={SECTION} aria-labelledby="questions">
          <SectionHeading id="questions">FAQs</SectionHeading>
          <QuestionList />
        </section>
        <section id="checkout" className={`${SECTION} scroll-mt-16 pb-[16vh]`} aria-labelledby="start">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-8 lg:sticky lg:top-24">
              <SectionHeading id="start">Start your plan</SectionHeading>
              <PriceSummary price={price} />
              <p className="text-ink-soft text-lg text-pretty">
                Have a question first? Reply to our email or write to{" "}
                <a href="mailto:hello@defect.tech" className="text-ink decoration-ink/30 hover:decoration-ink underline underline-offset-4">
                  hello@defect.tech
                </a>
                .
              </p>
            </div>
            <CheckoutArea business={business} code={code} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
