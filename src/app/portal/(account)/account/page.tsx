import { SignOut } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card } from "@/components/admin/ui";
import PasswordForm from "@/components/portal/PasswordForm";
import PortalShell from "@/components/portal/PortalShell";
import { hasPassword } from "@/server/portal/accounts";
import { portalContext } from "@/server/portal/context";
import { signOutAction } from "../../actions";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const context = await portalContext((await searchParams).site);
  const passwordSet = await hasPassword(context.owner.email);
  return (
    <PortalShell context={context} path="/portal/account">
      <h1 className="text-3xl font-semibold sm:text-4xl">Account</h1>
      <div className="flex max-w-2xl flex-col gap-6">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <dl className="flex min-w-0 flex-col gap-1">
            <dt className="text-ink-soft text-sm">Signed in as</dt>
            <dd className="truncate text-lg font-medium">{context.owner.email}</dd>
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
          <PasswordForm hasPassword={passwordSet} email={context.owner.email} />
        </Card>
        <p className="text-ink-soft text-pretty">
          To change the email you sign in with, or who owns your website, email <a href="mailto:hello@defect.tech" className="underline decoration-ink/30 underline-offset-4">hello@defect.tech</a>.
        </p>
      </div>
    </PortalShell>
  );
}
