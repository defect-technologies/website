import type { Business } from "@/server/db/schema";

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

type Step = { label: string; at: Date | null };

function stepsOf(business: Business): Step[] {
  const found = business.foundDate ? new Date(`${business.foundDate}T12:00:00`) : business.createdAt;
  return [
    { label: business.source === "request" ? "Asked us" : "Found", at: found },
    { label: "Preview", at: business.previewBuiltAt },
    { label: "Emailed", at: business.firstSentAt },
    { label: "Replied", at: business.repliedAt },
    { label: "Paid", at: business.paidAt },
    { label: "Live", at: business.launchedAt },
  ];
}

const ENDED: Partial<Record<Business["stage"], string>> = { lost: "Lost", opted_out: "Opted out" };

/** Where the business is on the way from found to live: reached steps are filled, the latest one is marked. */
export default function JourneyStrip({ business }: { business: Business }) {
  const steps = stepsOf(business);
  const reached = steps.reduce((last, step, index) => (step.at ? index : last), 0);
  const ended = ENDED[business.stage];
  return (
    <ol className="grid grid-cols-6" aria-label="Progress">
      {steps.map((step, index) => {
        const done = index <= reached;
        const latest = index === reached;
        return (
          <li key={step.label} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={latest ? "step" : undefined}>
            {index > 0 && <span aria-hidden="true" className={`absolute top-[7px] right-1/2 h-0.5 w-full ${done ? "bg-ink" : "bg-ink/12"}`} />}
            <span
              aria-hidden="true"
              className={`relative size-4 rounded-full ${latest ? (ended ? "bg-ink-faint" : "bg-vermilion ring-vermilion/25 ring-4") : done ? "bg-ink" : "bg-paper ring-ink/20 ring-2 ring-inset"}`}
            />
            <span className={`text-sm ${latest ? "font-semibold" : done ? "text-ink-soft" : "text-ink-faint"}`}>{latest && ended ? ended : step.label}</span>
            <span className="text-ink-faint text-xs tabular-nums">{step.at ? shortDate.format(step.at) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
