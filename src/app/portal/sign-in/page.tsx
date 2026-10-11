import { EnvelopeSimple, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/Button";
import SubmitButton from "@/components/admin/SubmitButton";
import { Notice } from "@/components/admin/ui";
import EditorBrand from "@/components/editor/EditorBrand";
import LinkSentNotice from "@/components/editor/LinkSentNotice";
import PortalSignInForm from "@/components/portal/PortalSignInForm";
import { maskEmail, siteName } from "@/server/editor/signInLinks";
import { env } from "@/server/env";
import { safeNext } from "@/server/portal/accounts";
import { currentOwner } from "@/server/portal/session";
import { clientSite, type ClientSiteRow } from "@/server/sites/clientSites";
import { emailOwnerLinkAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Try again, or use your email.",
  "no-site": "That Google account doesn't own a site with us. Sign in with the email address you gave us.",
};

/** When we know the site, its owner gets a link in one click, with no address to type. */
function OneClickLink({ site }: { site: ClientSiteRow }) {
  return (
    <form action={emailOwnerLinkAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="site" value={site.slug} />
      <SubmitButton variant="solid" icon={<EnvelopeSimple size={20} weight="bold" aria-hidden="true" />}>
        Email me a sign-in link
      </SubmitButton>
      <p className="text-ink-soft text-sm">It goes to {maskEmail(site.ownerEmail)}.</p>
    </form>
  );
}

function Divider() {
  return (
    <div className="text-ink-soft flex w-full items-center gap-3 text-sm" aria-hidden="true">
      <span className="bg-paper-shade h-px flex-1" />
      or
      <span className="bg-paper-shade h-px flex-1" />
    </div>
  );
}

type Search = { site?: string; result?: string; error?: string; next?: string };

export default async function PortalSignInPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { site: slug, result, error, next: rawNext } = await searchParams;
  const site = slug ? await clientSite(slug) : null;
  const next = site ? `/portal/edit/${site.slug}` : safeNext(rawNext);
  if (await currentOwner()) redirect(next);
  const sent = site && result === "sent";
  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        <h1 className="text-2xl font-semibold text-balance">{site ? `Sign in to edit ${siteName(site.businessName, site.url)}` : "Sign in to your portal"}</h1>
        {error && ERRORS[error] && <Notice tone="bad">{ERRORS[error]}</Notice>}
        {sent ? (
          <LinkSentNotice>We sent a sign-in link to {maskEmail(site.ownerEmail)}. It works once, within 15 minutes.</LinkSentNotice>
        ) : (
          <>
            {site && <OneClickLink site={site} />}
            {env.portalGoogle() && (
              <a href={`/api/auth/google?portal=${encodeURIComponent(next)}`} className={buttonClasses(site ? "soft" : "solid", "md", "w-full")}>
                <GoogleLogo size={20} weight="bold" aria-hidden="true" />
                Continue with Google
              </a>
            )}
            {(site || env.portalGoogle()) && <Divider />}
            <PortalSignInForm next={next} />
          </>
        )}
        <p className="text-ink-soft text-sm text-pretty">
          Stuck? Email <a href="mailto:hello@defect.tech" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">hello@defect.tech</a> and we&apos;ll help you in.
        </p>
      </div>
    </main>
  );
}
