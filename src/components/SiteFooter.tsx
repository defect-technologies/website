import Link from "next/link";

const LINK = "text-ink-soft hover:text-ink rounded-md px-2 py-1 focus-visible:outline-2 focus-visible:outline-ink";

export default function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-8">
      <p className="text-ink-soft px-2">Defect Technologies</p>
      <ul className="flex flex-wrap gap-2">
        <li>
          <Link href="/terms" className={LINK}>
            Terms
          </Link>
        </li>
        <li>
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
        </li>
        <li>
          <a href="mailto:hello@defect.tech" className={LINK}>
            hello@defect.tech
          </a>
        </li>
      </ul>
    </footer>
  );
}
