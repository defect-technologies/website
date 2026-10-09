import { GoogleLogo, Wrench } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buttonClasses } from "@/components/Button";
import KnifeStroke from "@/components/admin/KnifeStroke";
import { Notice } from "@/components/admin/ui";
import { currentFounder } from "@/server/auth/session";
import { devShortcutsEnabled } from "@/server/env";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "not-configured": "Google sign-in isn't set up yet. Add GOOGLE_SIGNIN_CLIENT_ID and GOOGLE_SIGNIN_CLIENT_SECRET in Vercel.",
  failed: "Google didn't finish signing you in. Try again.",
  "not-a-founder": "That Google account isn't one of the two allowed in. Sign in with your own account, or add it to ADMIN_EMAILS.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentFounder()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <main className="grid min-h-svh place-items-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <div className="relative isolate px-6">
          <KnifeStroke className="text-vermilion/20 absolute inset-x-0 top-1/2 -z-10 h-10 w-full -translate-y-1/3" />
          <p className="font-script text-ink text-6xl leading-[1.4]">defect.tech</p>
        </div>
        {error && ERRORS[error] && (
          <Notice tone="bad" className="w-full text-left">
            {ERRORS[error]}
          </Notice>
        )}
        <div className="flex w-full flex-col gap-3">
          <a href="/api/auth/google" className={buttonClasses("solid")}>
            <GoogleLogo size={20} weight="bold" aria-hidden="true" />
            Sign in with Google
          </a>
          {devShortcutsEnabled && (
            <a href="/api/auth/dev" className={buttonClasses("ghost", "sm")}>
              <Wrench size={16} aria-hidden="true" />
              Sign in without Google (local only)
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
