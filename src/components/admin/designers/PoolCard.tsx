import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { BoardPicture } from "@/components/admin/designs/parts";
import { When } from "@/components/admin/ui";
import type { BoardWithLead } from "@/server/boards/store";

/** A business whose designs no designer has decided on yet: their three first screens beside who it is. */
export default function PoolCard({ board, place }: { board: BoardWithLead; place: string }) {
  return (
    <li>
      <Link
        href={`/designer/designs/${board.id}`}
        className="group bg-surface shadow-card hover:shadow-lifted focus-visible:outline-ink grid gap-4 rounded-2xl p-3 transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-center md:gap-6"
      >
        <span className="grid grid-cols-3 gap-2" aria-hidden="true">
          {board.options.map((option) => (
            <span key={option.letter}>
              <BoardPicture src={option.pictures.phone} alt="" className="aspect-[390/844] rounded-md object-cover object-top md:hidden" />
              <BoardPicture src={option.pictures.desktop} alt="" className="aspect-[16/10] rounded-md object-cover object-top max-md:hidden" />
            </span>
          ))}
        </span>
        <span className="flex min-w-0 flex-col items-start gap-1 px-2 pb-2 md:p-0">
          <span className="text-xl font-semibold text-balance">{board.businessName}</span>
          {place && <span className="text-ink-soft">{place}</span>}
          <span className="text-ink-faint text-sm">
            Drawn <When date={board.createdAt} />
          </span>
          <span className={buttonClasses("soft", "sm", "group-hover:bg-paper-shade/70 mt-3")}>
            See the three designs
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </span>
      </Link>
    </li>
  );
}
