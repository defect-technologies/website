import type { Metadata } from "next";
import EditorBrand from "@/components/editor/EditorBrand";
import SignInForm from "@/components/editor/SignInForm";

export const metadata: Metadata = { title: "Sign in to edit your site" };

export default function EditorSignInPage() {
  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        <EditorBrand />
        <h1 className="text-2xl font-semibold text-balance">Sign in to edit your site</h1>
        <SignInForm />
        <p className="text-ink-soft text-sm text-pretty">
          Rather not? Email <a href="mailto:hello@defect.tech" className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink">hello@defect.tech</a> and we&apos;ll make the change for you.
        </p>
      </div>
    </main>
  );
}
