import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { BoardPicture } from "@/components/admin/designs/parts";
import { When } from "@/components/admin/ui";
import type { BoardWithLead } from "@/server/boards/store";

/** Designs no designer has decided on yet: their three first screens, opening the designs to decide on. */
export default function PoolCard({ board, place }: { board: BoardWithLead; place: string }) {
  return (
    <li>
      <Link href={`/designer/designs/${board.id}`} className="bg-surface shadow-card hover:shadow-lifted focus-visible:outline-ink flex flex-col gap-4 rounded-2xl p-4 transition-shadow duration-150 focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="grid grid-cols-3 gap-3" aria-hidden="true">
          {board.options.map((option) => (
            <span key={option.letter}>
              <BoardPicture src={option.pictures.phone} alt="" className="aspect-[390/844] rounded-lg object-cover object-top lg:hidden" />
              <BoardPicture src={option.pictures.desktop} alt="" className="aspect-[16/10] rounded-lg object-cover object-top max-lg:hidden" />
            </span>
          ))}
        </span>
        <span className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-xl font-semibold">{board.businessName}</span>
            {place && <span className="text-ink-soft text-sm">{place}</span>}
            <span className="text-ink-faint text-sm">
              Drawn <When date={board.createdAt} />
            </span>
          </span>
          <CaretRight size={20} weight="bold" className="text-ink-faint shrink-0" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}
