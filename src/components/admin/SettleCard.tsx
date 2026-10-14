import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { settleMonthAction } from "@/app/admin/(panel)/money/actions";
import { FOUNDER_EMAILS, founderName } from "@/lib/founders";
import { formatCents, monthName, type MonthBalance } from "@/lib/settleUp";
import KnifeStroke from "./KnifeStroke";
import SubmitButton from "./SubmitButton";
import { Card, KeyValue } from "./ui";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function lastDayOf(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return shortDate.format(new Date(Date.UTC(year, monthIndex, 0)));
}

/** The Zelle that evens out a month: who sends whom how much, and the button that records it. */
export default function SettleCard({ balance, isDue }: { balance: MonthBalance; isDue: boolean }) {
  const owed = balance.owed!;
  return (
    <Card className="flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold">
            {founderName(owed.from)} <ArrowRight size={18} weight="bold" aria-label="sends" /> {founderName(owed.to)}
          </p>
          <p className="relative isolate w-fit">
            <KnifeStroke className="text-vermilion/25 absolute -inset-x-3 inset-y-1 -z-10 h-[calc(100%-0.5rem)] w-[calc(100%+1.5rem)]" />
            <span className="font-display text-6xl leading-none font-black tabular-nums">{formatCents(owed.amountCents)}</span>
          </p>
          <p className={isDue ? "text-ink mt-2 font-medium" : "text-ink-faint mt-2"}>
            {isDue ? `For ${monthName(balance.month)}` : `${monthName(balance.month)} so far, due after ${lastDayOf(balance.month)}`}
          </p>
        </div>
        <KeyValue
          rows={[
            ...FOUNDER_EMAILS.map((email): [string, string] => [`${founderName(email)} paid`, formatCents(balance.paidCents[email] ?? 0)]),
            ["Total", formatCents(balance.totalCents)],
          ]}
        />
      </div>
      <form action={settleMonthAction}>
        <input type="hidden" name="month" value={balance.month} />
        <SubmitButton variant={isDue ? "solid" : "soft"} icon={<CheckCircle size={18} weight="bold" aria-hidden="true" />}>
          Mark sent by Zelle
        </SubmitButton>
      </form>
    </Card>
  );
}
