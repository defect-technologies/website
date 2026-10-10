import { CaretRight, Flask } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/Button";
import type { ArmFunnel as Funnel } from "@/server/leads/businesses";
import ArmFunnel from "../ArmFunnel";
import ImportForm from "../ImportForm";
import { Card } from "../ui";

function SampleButton() {
  return (
    <form action="/api/dev/sample" method="post">
      <Button type="submit" size="sm" variant="ghost" icon={<Flask size={16} aria-hidden="true" />}>
        Load made-up sample leads (local only)
      </Button>
    </form>
  );
}

/** Adding leads, and the price test, which the old Pipeline page held. */
export default function LeadTools({ arms, samples }: { arms: Funnel[]; samples: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start gap-3">
        <ImportForm />
        {samples && <SampleButton />}
      </div>
      <details className="group/price">
        <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <CaretRight size={14} weight="bold" className="transition-transform duration-150 group-open/price:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
          Compare $59 and $79
        </summary>
        <Card className="mt-3 p-5">
          <ArmFunnel arms={arms} />
        </Card>
      </details>
    </div>
  );
}
