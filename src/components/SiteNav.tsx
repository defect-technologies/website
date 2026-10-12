import Link from "next/link";
import { ButtonLink } from "./Button";

/** On "start" the visitor is already requesting a website, and on "welcome" we've already built theirs, so neither offers it. */
type Page = "home" | "team" | "start" | "welcome" | "other";

const LINK = "text-ink rounded-md px-2 py-1 text-base font-medium hover:bg-paper-shade focus-visible:outline-2 focus-visible:outline-ink";

/** On the home page the painted wordmark is the title, so the small one only appears elsewhere. */
export default function SiteNav({ page }: { page: Page }) {
  return (
    <nav className="bg-paper/85 fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between px-4 backdrop-blur-sm sm:px-8">
      {page === "home" ? (
        <span />
      ) : (
        <Link href="/" className="font-script text-ink rounded-md px-2 text-3xl leading-[1.4] focus-visible:outline-2 focus-visible:outline-ink">
          defect.tech
        </Link>
      )}
      <div className="flex items-center gap-2">
        {page === "home" ? (
          <Link href="/team" className={LINK}>
            Team
          </Link>
        ) : (
          <Link href="/" className={LINK}>
            Home
          </Link>
        )}
        <Link href="/portal" className={LINK}>
          Portal
        </Link>
        {page !== "start" && page !== "welcome" && (
          <ButtonLink href="/start" size="sm">
            Request a website
          </ButtonLink>
        )}
      </div>
    </nav>
  );
}
