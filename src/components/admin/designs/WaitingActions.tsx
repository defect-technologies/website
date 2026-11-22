import { ArrowsClockwise, Broom } from "@phosphor-icons/react/dist/ssr";
import { clearAllWaitingAction, redrawAllWaitingAction } from "@/app/admin/(panel)/designs/actions";
import ConfirmAll from "./ConfirmAll";

/** Every waiting design drawn again with the runner's current system, or cleared with nothing drawn. */
export default function WaitingActions({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ConfirmAll action={clearAllWaitingAction} icon={<Broom size={18} weight="bold" aria-hidden="true" />} label={`Clear all ${count}`} confirm={`Clear all ${count} without new designs`} />
      <ConfirmAll action={redrawAllWaitingAction} icon={<ArrowsClockwise size={18} weight="bold" aria-hidden="true" />} label={`Redraw all ${count}`} confirm={`Replace all ${count} with new designs`} />
    </div>
  );
}
