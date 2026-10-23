import { SignOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import SiteEditors from "@/components/admin/SiteEditors";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, Notice } from "@/components/admin/ui";
import PasswordForm from "@/components/portal/PasswordForm";
import PortalShell from "@/components/portal/PortalShell";
import { siteName } from "@/server/editor/signInLinks";
import { hasPassword } from "@/server/portal/accounts";
import { isOwnerOf, portalContext, type PortalContext } from "@/server/portal/context";
import { editorsOf } from "@/server/sites/siteEditors";
import { addEditorAction, removeEditorAction, signOutAction } from "../../actions";

export const metadata: Metadata = { title: "Account" };

const EDITOR_RESULTS: Record<string, { tone: "good" | "bad"; text: string }> = {
  added: { tone: "good", text: "Added. They can sign in at defect.tech/portal with that email." },
  "already-editor": { tone: "good", text: "They can already edit this website." },
  "is-owner": { tone: "bad", text: "That's your own email. You can already edit this website." },
  invalid: { tone: "bad", text: "Check that email address and try again." },
  removed: { tone: "good", text: "Removed. They can't sign in to edit this website anymore." },
};

async function EditorsSection({ context, result }: { context: PortalContext; result?: string }) {
  const { site } = context;
  const name = siteName(site.businessName, site.url);
  if (!isOwnerOf(site)) {
    return (
      <Card className="flex flex-col gap-2 p-6">
        <h2 className="text-xl font-semibold">Editors</h2>
        <p className="text-ink-soft text-pretty">
          You can edit {name}. {site.ownerEmail} owns it and chooses who else can.
        </p>
      </Card>
    );
  }
  const editors = await editorsOf(site.id);
  const notice = result ? EDITOR_RESULTS[result] : undefined;
  return (
    <SiteEditors
      slug={site.slug}
      editors={editors}
      addAction={addEditorAction}
      removeAction={removeEditorAction}
      addHint="Editors can sign in and change your website. Billing and requests to us stay with you."
      header={
        <>
          <h2 className="text-xl font-semibold">{context.sites.length > 1 ? `Editors of ${name}` : "Editors"}</h2>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        </>
      }
    />
  );
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ site?: string; editors?: string }> }) {
  const query = await searchParams;
  const context = await portalContext(query.site);
  const passwordSet = await hasPassword(context.user.email);
  return (
    <PortalShell context={context} path="/portal/account">
      <h1 className="text-3xl font-semibold sm:text-4xl">Account</h1>
      <div className="flex max-w-2xl flex-col gap-6">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <dl className="flex min-w-0 flex-col gap-1">
            <dt className="text-ink-soft text-sm">Signed in as</dt>
            <dd className="truncate text-lg font-medium">{context.user.email}</dd>
          </dl>
          <form action={signOutAction}>
            <SubmitButton variant="soft" icon={<SignOut size={20} aria-hidden="true" />}>
              Sign out
            </SubmitButton>
          </form>
        </Card>
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-xl font-semibold">Password</h2>
          {!passwordSet && <p className="text-ink-soft text-pretty">Set one to sign in with your email and password instead of a link.</p>}
          <PasswordForm hasPassword={passwordSet} email={context.user.email} />
        </Card>
        <EditorsSection context={context} result={query.editors} />
        <p className="text-ink-soft text-pretty">
          To change the email you sign in with, or who owns your website, email <a href="mailto:hello@defect.tech" className="underline decoration-ink/30 underline-offset-4">hello@defect.tech</a>.
        </p>
      </div>
    </PortalShell>
  );
}
