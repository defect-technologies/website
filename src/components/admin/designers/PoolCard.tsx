import { HandGrabbing } from "@phosphor-icons/react/dist/ssr";
import { BoardPicture } from "@/components/admin/designs/parts";
import SubmitButton from "@/components/admin/SubmitButton";
import { When } from "@/components/admin/ui";
import type { BoardWithLead } from "@/server/boards/store";

/** A business no designer has taken yet: its three first screens, and the button that makes it the designer's. */
export default function PoolCard({ board, place, claim }: { board: BoardWithLead; place: string; claim: (formData: FormData) => Promise<void> }) {
  return (
    <li className="bg-surface shadow-card flex flex-col gap-4 rounded-2xl p-4">
      <span className="grid grid-cols-3 gap-3" aria-hidden="true">
        {board.options.map((option) => (
          <span key={option.letter}>
            <BoardPicture src={option.pictures.phone} alt="" className="aspect-[390/844] rounded-lg object-cover object-top lg:hidden" />
            <BoardPicture src={option.pictures.desktop} alt="" className="aspect-[16/10] rounded-lg object-cover object-top max-lg:hidden" />
          </span>
        ))}
      </span>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xl font-semibold">{board.businessName}</h2>
          {place && <span className="text-ink-soft text-sm">{place}</span>}
          <span className="text-ink-faint text-sm">
            Waiting since <When date={board.createdAt} />
          </span>
        </div>
        <form action={claim}>
          <input type="hidden" name="id" value={board.id} />
          <SubmitButton variant="solid" icon={<HandGrabbing size={18} aria-hidden="true" />}>
            Take this business
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
