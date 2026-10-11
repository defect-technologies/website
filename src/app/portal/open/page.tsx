import { ArrowRight, LinkBreak } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import SubmitButton from "@/components/admin/SubmitButton";
import EditorBrand from "@/components/editor/EditorBrand";
import { portalLinkIsGood } from "@/server/portal/accounts";
import { openLinkAction } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

/** Opening the page only looks at the link; pressing the button spends it, so mail scanners can't use it up first. */
export default async function OpenPortalLinkPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code ?? "";
  const good = await portalLinkIsGood(code);
  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        {good ? (
          <form action={openLinkAction} className="flex w-full flex-col gap-4">
            <input type="hidden" name="code" value={code} />
            <h1 className="text-2xl font-semibold text-balance">Sign in to your portal</h1>
            <SubmitButton variant="solid" icon={<ArrowRight size={20} weight="bold" aria-hidden="true" />}>
              Continue
            </SubmitButton>
          </form>
        ) : (
          <div className="flex w-full flex-col items-center gap-4">
            <LinkBreak size={32} className="text-ink" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-balance">Ask for a new link</h1>
            <p className="text-ink-soft text-pretty">This link has been used or has expired. Each one works once, within 15 minutes.</p>
            <ButtonLink href="/portal/sign-in">Sign in</ButtonLink>
          </div>
        )}
      </div>
    </main>
  );
}
