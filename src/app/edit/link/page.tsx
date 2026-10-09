import { SignIn } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SubmitButton from "@/components/admin/SubmitButton";
import EditorBrand from "@/components/editor/EditorBrand";
import { redeemLinkAction } from "../actions";

export const metadata: Metadata = { title: "Finish signing in" };

/**
 * The emailed link lands here instead of signing in on GET, because mail
 * scanners open links before people do and would use up a one-time token.
 */
export default async function SignInLinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/edit/sign-in");

  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <form action={redeemLinkAction} className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        <h1 className="text-2xl font-semibold text-balance">You&apos;re almost in</h1>
        <input type="hidden" name="token" value={token} />
        <SubmitButton variant="solid" className="w-full" icon={<SignIn size={20} weight="bold" aria-hidden="true" />}>
          Continue to your site
        </SubmitButton>
      </form>
    </main>
  );
}
