import { ArrowSquareOut, ClockCounterClockwise, PencilSimple, SignOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import SubmitButton from "@/components/admin/SubmitButton";
import { signOutAction } from "@/app/edit/actions";

type Page = "editor" | "history";

/** Site name on the left; switching between editing and earlier versions, the live site, and sign out on the right. */
export default function EditorHeader({ slug, businessName, liveUrl, page }: { slug: string; businessName: string; liveUrl: string; page: Page }) {
  const other =
    page === "editor"
      ? { href: `/edit/${slug}/history`, label: "Earlier versions", icon: <ClockCounterClockwise size={16} aria-hidden="true" /> }
      : { href: `/edit/${slug}`, label: "Back to editing", icon: <PencilSimple size={16} aria-hidden="true" /> };
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-baseline gap-4">
        <span className="font-script text-ink text-3xl leading-[1.4]" aria-hidden="true">
          defect.tech
        </span>
        <h1 className="font-display min-w-0 truncate text-4xl leading-none font-black">{businessName}</h1>
      </div>
      <nav aria-label="Editor" className="flex flex-wrap items-center gap-1">
        <Link href={other.href} className={buttonClasses("ghost", "sm")}>
          {other.icon}
          {other.label}
        </Link>
        {liveUrl && (
          <a href={liveUrl} target="_blank" rel="noreferrer" className={buttonClasses("ghost", "sm")}>
            <ArrowSquareOut size={16} aria-hidden="true" />
            View your live site
          </a>
        )}
        <form action={signOutAction}>
          <SubmitButton variant="ghost" size="sm" icon={<SignOut size={16} aria-hidden="true" />}>
            Sign out
          </SubmitButton>
        </form>
      </nav>
    </header>
  );
}
