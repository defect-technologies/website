import { SignOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import DesignerNav from "@/components/admin/designers/DesignerNav";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireDesigner } from "@/server/auth/designerSession";
import { pool } from "@/server/designers/claims";
import { designerTurns } from "@/server/designers/work";
import { designerSignOutAction } from "./actions";

/** The designer's area, laid out as the founders' admin is, with only the designer's own pages. */
export default async function DesignerLayout({ children }: { children: React.ReactNode }) {
  const designer = await requireDesigner();
  const [turns, open] = await Promise.all([designerTurns(designer.id), pool()]);

  return (
    <div className="mx-auto grid min-h-svh w-full max-w-[90rem] grid-cols-1 gap-6 px-4 pt-4 pb-16 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:pt-8 lg:pb-0">
      <aside className="flex flex-col gap-4 lg:sticky lg:top-8 lg:h-[calc(100svh-4rem)]">
        <Link href="/" className="font-script text-ink w-fit rounded-md px-3 text-3xl leading-[1.4] focus-visible:outline-2 focus-visible:outline-ink">
          defect.tech
        </Link>
        <DesignerNav counts={{ todo: turns.length + open.length }} />
        <form action={designerSignOutAction} className="flex items-center gap-2 lg:mt-auto">
          <span className="text-ink-faint min-w-0 truncate px-3 text-sm" title={designer.email}>
            {designer.name}
          </span>
          <SubmitButton variant="ghost" size="sm" icon={<SignOut size={16} aria-hidden="true" />}>
            Sign out
          </SubmitButton>
        </form>
      </aside>
      <main className="flex min-w-0 flex-col gap-8 lg:pb-16">{children}</main>
    </div>
  );
}
