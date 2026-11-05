import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";

/** The page a `?page=` value asks for: anything that isn't a positive whole number means the first. */
export function pageFrom(value: string | undefined): number {
  return Math.max(1, Math.floor(Number(value) || 1));
}

type PagerProps = {
  page: number;
  pages: number;
  href: (page: number) => string;
  /** What the two directions mean on this list, when it is more than "previous" and "next". */
  back?: string;
  forward?: string;
};

export default function Pager({ page, pages, href, back = "Previous", forward = "Next" }: PagerProps) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClasses("soft", "sm")}>
          <CaretLeft size={14} aria-hidden="true" /> {back}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-faint tabular-nums">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClasses("soft", "sm")}>
          {forward} <CaretRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
