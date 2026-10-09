import type { ArmFunnel as Funnel } from "@/server/leads/businesses";

const STEPS = [
  { key: "sent", label: "Sent" },
  { key: "clicked", label: "Clicked" },
  { key: "replied", label: "Replied" },
  { key: "paid", label: "Paid" },
] as const;

const ARM_BAR: Record<number, string> = { 59: "bg-arm-59", 79: "bg-arm-79" };

function share(count: number, of: number) {
  return of === 0 ? 0 : count / of;
}

function Bar({ count, of, arm }: { count: number; of: number; arm: number }) {
  const width = share(count, of) * 100;
  return (
    <div className="flex items-center gap-3" title={`$${arm}: ${count} of ${of} leads (${Math.round(width)}%)`}>
      <div className="bg-paper-shade/70 relative h-3 flex-1 overflow-hidden rounded-full">
        <div className={`absolute inset-y-0 left-0 rounded-full ${ARM_BAR[arm] ?? "bg-ink"}`} style={{ width: `${Math.max(width, count > 0 ? 3 : 0)}%` }} />
      </div>
      <span className="w-20 shrink-0 text-sm tabular-nums">
        <span className="font-semibold">{count}</span>
        <span className="text-ink-faint"> of {of}</span>
      </span>
    </div>
  );
}

/**
 * How far each price arm's leads got. Bars are a share of that arm's leads,
 * and the counts stay visible because at this sample size one sale matters.
 */
export default function ArmFunnel({ arms }: { arms: Funnel[] }) {
  if (arms.length === 0) return <p className="text-ink-soft">No lead has a price arm yet. Arms are assigned when leads are imported.</p>;
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-5 text-sm" aria-label="Legend">
        {arms.map((arm) => (
          <li key={arm.arm} className="flex items-center gap-2">
            <span aria-hidden="true" className={`size-3 rounded-full ${ARM_BAR[arm.arm] ?? "bg-ink"}`} />
            <span className="font-medium">${arm.arm} a month</span>
            <span className="text-ink-faint tabular-nums">{arm.leads} leads</span>
          </li>
        ))}
      </ul>
      <table className="w-full border-collapse">
        <caption className="sr-only">Leads reaching each step, by price arm</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Step</th>
            {arms.map((arm) => (
              <th key={arm.arm} scope="col">
                ${arm.arm}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {STEPS.map((step) => (
            <tr key={step.key} className="align-middle">
              <th scope="row" className="w-20 py-2 pr-4 text-left text-sm font-medium">
                {step.label}
              </th>
              <td className="py-2">
                <div className="flex flex-col gap-1.5">
                  {arms.map((arm) => (
                    <Bar key={arm.arm} count={arm[step.key]} of={arm.leads} arm={arm.arm} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
