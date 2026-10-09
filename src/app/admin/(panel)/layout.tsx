import { SignOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminNav from "@/components/admin/AdminNav";
import SubmitButton from "@/components/admin/SubmitButton";
import { endSession, requireFounder } from "@/server/auth/session";
import { navCounts } from "@/server/navCounts";

async function signOut() {
  "use server";
  await endSession();
  redirect("/admin/sign-in");
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const founder = await requireFounder();
  const counts = await navCounts();

  return (
    <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-6 px-4 pt-4 pb-16 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:pt-8">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-[calc(100svh-4rem)]">
        <Link href="/" className="font-script text-ink w-fit rounded-md px-3 text-3xl leading-[1.4] focus-visible:outline-2 focus-visible:outline-ink">
          defect.tech
        </Link>
        <AdminNav counts={counts} />
        <form action={signOut} className="flex items-center gap-2 lg:mt-auto">
          <span className="text-ink-faint min-w-0 truncate px-3 text-sm" title={founder.email}>
            {founder.name}
          </span>
          <SubmitButton variant="ghost" size="sm" icon={<SignOut size={16} aria-hidden="true" />}>
            Sign out
          </SubmitButton>
        </form>
      </aside>
      <main className="flex min-w-0 flex-col gap-8">{children}</main>
    </div>
  );
}
