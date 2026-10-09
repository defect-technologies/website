import Link from "next/link";

type Page = "home" | "team";

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
      {page === "home" ? (
        <Link href="/team" className={LINK}>
          Team
        </Link>
      ) : (
        <Link href="/" className={LINK}>
          Home
        </Link>
      )}
    </nav>
  );
}
