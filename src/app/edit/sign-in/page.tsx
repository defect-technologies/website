import { Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/Button";
import { Notice } from "@/components/admin/ui";
import EditorBrand from "@/components/editor/EditorBrand";
import SignInForm from "@/components/editor/SignInForm";
import { currentOwner } from "@/server/auth/ownerSession";
import { devShortcutsEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Sign in to edit your site" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has already been used or has expired. Ask for a new one below.",
};

export default async function EditorSignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentOwner()) redirect("/edit");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        <h1 className="text-2xl font-semibold text-balance">Sign in to edit your site</h1>
        {error && ERRORS[error] && (
          <Notice tone="bad" className="w-full text-left">
            {ERRORS[error]}
          </Notice>
        )}
        <SignInForm />
        {devShortcutsEnabled && (
          <a href="/api/edit/dev" className={buttonClasses("ghost", "sm")}>
            <Wrench size={16} aria-hidden="true" />
            Sign in as the sample florist (local only)
          </a>
        )}
        <p className="text-ink-soft text-sm text-pretty">
          Rather not? Email <a href="mailto:hello@defect.tech" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">hello@defect.tech</a> and we&apos;ll make the change for you.
        </p>
      </div>
    </main>
  );
}
