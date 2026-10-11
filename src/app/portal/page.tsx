import { ArrowUpRight, CreditCard, EnvelopeSimple, PencilSimple, SignOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import SubmitButton from "@/components/admin/SubmitButton";
import { Notice } from "@/components/admin/ui";
import PasswordForm from "@/components/portal/PasswordForm";
import { siteName } from "@/server/editor/signInLinks";
import { hasPassword } from "@/server/portal/accounts";
import { requireOwner } from "@/server/portal/session";
import { sitesForOwner, type OwnerSite } from "@/server/sites/clientSites";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Your portal" };

const BILLING_PROBLEMS: Record<string, string> = {
  missing: "We couldn't find a plan for that site. Email hello@defect.tech and we'll sort it out.",
  failed: "The billing page didn't open. Try again in a minute.",
};

function SiteCard({ site }: { site: OwnerSite }) {
  const name = siteName(site.businessName, site.url);
  const changeEmail = `mailto:hello@defect.tech?subject=${encodeURIComponent(`A change to ${name}`)}`;
  return (
    <section aria-labelledby={`site-${site.slug}`} className="bg-surface shadow-card flex flex-col gap-5 rounded-2xl p-6">
      <div>
        <h2 id={`site-${site.slug}`} className="text-xl font-semibold text-balance">
          {name}
        </h2>
        <a href={site.url} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink mt-1 inline-flex items-center gap-1 underline decoration-ink/20 underline-offset-4">
          {new URL(site.url).host}
          <ArrowUpRight size={14} aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      <div className="flex flex-wrap gap-3">
        {/* Plain links, not next/link: prefetching would open the editor and billing pages in the background. */}
        <a href={`/portal/edit/${site.slug}`} className={buttonClasses("solid")}>
          <PencilSimple size={20} weight="bold" aria-hidden="true" />
          Edit my website
        </a>
        {site.stripeCustomerId && (
          <a href={`/portal/billing/${site.slug}`} className={buttonClasses("soft")}>
            <CreditCard size={20} aria-hidden="true" />
            Billing
          </a>
        )}
        <a href={changeEmail} className={buttonClasses("soft")}>
          <EnvelopeSimple size={20} aria-hidden="true" />
          Ask us for a change
        </a>
      </div>
    </section>
  );
}

export default async function PortalPage({ searchParams }: { searchParams: Promise<{ billing?: string }> }) {
  const owner = await requireOwner();
  const [sites, passwordSet, { billing }] = await Promise.all([sitesForOwner(owner.email), hasPassword(owner.email), searchParams]);
  return (
    <>
      <header className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" className="font-script text-ink rounded-md px-2 text-3xl leading-[1.4] focus-visible:outline-2 focus-visible:outline-ink">
          defect.tech
        </Link>
        <form action={signOutAction} className="flex min-w-0 items-center gap-3">
          <span className="text-ink-soft truncate text-sm">{owner.email}</span>
          <SubmitButton variant="ghost" size="sm" icon={<SignOut size={16} aria-hidden="true" />}>
            Sign out
          </SubmitButton>
        </form>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-6 pb-16">
        <h1 className="text-3xl font-semibold">{sites.length > 1 ? "Your websites" : "Your website"}</h1>
        {billing && BILLING_PROBLEMS[billing] && <Notice tone="bad">{BILLING_PROBLEMS[billing]}</Notice>}
        {sites.map((site) => (
          <SiteCard key={site.slug} site={site} />
        ))}
        <section aria-labelledby="password" className="bg-surface shadow-card flex flex-col gap-4 rounded-2xl p-6">
          <h2 id="password" className="text-xl font-semibold">
            Password
          </h2>
          {!passwordSet && <p className="text-ink-soft text-pretty">Set one to sign in with your email and password instead of a link.</p>}
          <PasswordForm hasPassword={passwordSet} email={owner.email} />
        </section>
      </main>
    </>
  );
}
