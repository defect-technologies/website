import { ArrowLeft, ArrowSquareOut, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@/components/Button";
import { Card } from "@/components/admin/ui";

type Props = {
  businessName: string;
  place: string;
  website: string;
  /** What the lead finder found wrong with their site, as "Copyright year 2017; no mobile layout". */
  problemSummary: string;
  /** The note an earlier set of designs was turned down with, when these were drawn from it. */
  notesBehind: string;
  back: { href: string; label: string };
};

function Problems({ summary }: { summary: string }) {
  const problems = summary.split(";").map((problem) => problem.trim()).filter(Boolean);
  if (!problems.length) return null;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-lg font-semibold">What&rsquo;s wrong with their site today</h2>
      <ul className="flex flex-col gap-1.5">
        {problems.map((problem) => (
          <li key={problem} className="text-ink-soft flex items-start gap-2 text-pretty">
            <WarningCircle size={18} className="text-warn mt-0.5 shrink-0" aria-hidden="true" />
            {problem.replace(/^./, (first) => first.toUpperCase())}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Who the designs are for: the business, where it is, its site today and what's wrong with it. */
export default function BusinessBrief({ businessName, place, website, problemSummary, notesBehind, back }: Props) {
  return (
    <header className="flex flex-col gap-5">
      <ButtonLink href={back.href} variant="ghost" className="-ml-3 w-fit">
        <ArrowLeft size={18} aria-hidden="true" />
        {back.label}
      </ButtonLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="font-display text-5xl leading-none font-black text-balance">{businessName}</h1>
          {place && <p className="text-ink-soft text-lg">{place}</p>}
        </div>
        {website && (
          <ButtonLink href={website} target="_blank" rel="noreferrer" variant="soft" icon={<ArrowSquareOut size={18} aria-hidden="true" />}>
            See their site today
          </ButtonLink>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Problems summary={problemSummary} />
        {notesBehind && (
          <Card className="flex flex-col gap-2 p-5">
            <h2 className="text-lg font-semibold">These were drawn again with this note</h2>
            <p className="text-ink-soft max-w-prose text-pretty whitespace-pre-line">{notesBehind}</p>
          </Card>
        )}
      </div>
    </header>
  );
}
