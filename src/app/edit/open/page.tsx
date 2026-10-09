import { ArrowRight, LinkBreak } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EditorBrand from "@/components/editor/EditorBrand";
import SubmitButton from "@/components/admin/SubmitButton";
import { inspectSignInLink, type LinkState } from "@/server/editor/signInLinks";
import { openEditorAction } from "../actions";

export const metadata: Metadata = { title: "Open the editor" };

const SPENT: Record<Exclude<LinkState["state"], "ready">, string> = {
  used: "This link has already been used. Each link opens the editor once, so ask for a new one.",
  expired: "This link has expired. Links work for 10 minutes, so ask for a new one.",
  unknown: "This link isn't one we recognize. Check that you opened the whole link from the email, or ask for a new one.",
};

function OpenForm({ code, siteAddress }: { code: string; siteAddress: string }) {
  return (
    <form action={openEditorAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <h1 className="text-2xl font-semibold text-balance">Edit {siteAddress}</h1>
      <SubmitButton variant="solid" icon={<ArrowRight size={20} weight="bold" aria-hidden="true" />}>
        Open the editor
      </SubmitButton>
    </form>
  );
}

function SpentLink({ message }: { message: string }) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <LinkBreak size={32} className="text-ink" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-balance">Ask for a new link</h1>
      <p className="text-ink-soft text-pretty">{message}</p>
      <ButtonLink href="/edit/sign-in">Email me a new link</ButtonLink>
    </div>
  );
}

/**
 * Opening the page only looks at the link. Pressing the button spends it, so
 * mail scanners that open every link on arrival can't use it up first.
 */
export default async function OpenEditorPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = (await searchParams).code ?? "";
  const link = await inspectSignInLink(code);
  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        {link.state === "ready" ? <OpenForm code={code} siteAddress={link.siteAddress} /> : <SpentLink message={SPENT[link.state]} />}
      </div>
    </main>
  );
}
