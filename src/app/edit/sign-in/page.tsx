import type { Metadata } from "next";
import EditorBrand from "@/components/editor/EditorBrand";
import LinkSentNotice from "@/components/editor/LinkSentNotice";
import SignInForm from "@/components/editor/SignInForm";
import SiteLinkButton from "@/components/editor/SiteLinkButton";
import { maskEmail, siteName } from "@/server/editor/signInLinks";
import { clientSite, type ClientSiteRow } from "@/server/sites/clientSites";

export const metadata: Metadata = { title: "Sign in to edit your site" };

const PROBLEMS: Record<string, string> = {
  failed: "The email didn't send. Try again in a minute.",
  "not-ready": "Email sign-in isn't switched on yet. Email hello@defect.tech and we'll make your change for you.",
};

/** A known site gets a one-click button that emails its owner; anyone else types their address. */
function SiteSignIn({ site, result }: { site: ClientSiteRow; result?: string }) {
  const maskedEmail = maskEmail(site.ownerEmail);
  if (result === "sent") {
    return <LinkSentNotice>We sent a sign-in link to {maskedEmail}. It opens the editor once, within 10 minutes.</LinkSentNotice>;
  }
  return (
    <>
      <h1 className="text-2xl font-semibold text-balance">Edit {siteName(site.businessName, site.url)}</h1>
      <SiteLinkButton slug={site.slug} maskedEmail={maskedEmail} problem={result ? PROBLEMS[result] : undefined} />
    </>
  );
}

export default async function EditorSignInPage({ searchParams }: { searchParams: Promise<{ site?: string; result?: string }> }) {
  const { site: slug, result } = await searchParams;
  const site = slug ? await clientSite(slug) : null;
  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        {site ? (
          <SiteSignIn site={site} result={result} />
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-balance">Sign in to edit your site</h1>
            <SignInForm />
          </>
        )}
        <p className="text-ink-soft text-sm text-pretty">
          Rather not? Email <a href="mailto:hello@defect.tech" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">hello@defect.tech</a> and we&apos;ll make the change for you.
        </p>
      </div>
    </main>
  );
}
