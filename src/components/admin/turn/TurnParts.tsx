import { ArrowRight, CaretRight, Eye, HandPalm, Swatches, Wrench } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import { BoardPicture } from "@/components/admin/designs/parts";
import PreviewThumb from "@/components/admin/PreviewThumb";
import { Card, StatusMark, When } from "@/components/admin/ui";
import type { Turn, TurnKind } from "@/lib/turn";

const ACTION: Record<TurnKind, string> = { repair: "Check the repairs", design: "Choose a design", review: "Review the site" };

/** What kind of look the item needs, as an icon and a few words. */
export function TurnMark({ turn }: { turn: Turn }) {
  if (turn.kind === "repair") return <StatusMark icon={Wrench} tone="ink" label="Back from a repair" detail="The builder made your notes' changes. Each note shows a before and an after." />;
  if (turn.kind === "design") return <StatusMark icon={Swatches} label="Three designs" detail="The site is built once one of them is chosen." />;
  if (turn.held) return <StatusMark icon={HandPalm} tone="warn" label="Held" detail="The outside reviewer wanted changes, so it waits for a review before outreach." />;
  return <StatusMark icon={Eye} label="Not looked at yet" />;
}

function FirstScreens({ turn, className, loading = "lazy" }: { turn: Turn; className: string; loading?: "lazy" | "eager" }) {
  return (
    <span aria-hidden="true" className={`grid grid-cols-3 ${className}`}>
      {turn.firstScreens.map((src) => (
        <BoardPicture key={src} src={src} alt="" loading={loading} className="aspect-[16/10] rounded-md object-cover object-top" />
      ))}
    </span>
  );
}

function UpNextFacts({ turn }: { turn: Turn }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <TurnMark turn={turn} />
      <h2 className="text-3xl leading-tight font-semibold text-balance">{turn.businessName}</h2>
      <span className="text-ink-faint text-sm">
        Waiting since <When date={turn.since} />
      </span>
    </div>
  );
}

function UpNextAction({ turn }: { turn: Turn }) {
  return (
    <ButtonLink href={turn.href} variant="solid" icon={<ArrowRight size={18} aria-hidden="true" />} className="shrink-0">
      {ACTION[turn.kind]}
    </ButtonLink>
  );
}

/**
 * The item a founder takes now, shown big enough to judge before opening it. Three designs are compared side by side,
 * so they get the card's whole width; a site is one picture beside its name.
 */
export function UpNext({ turn }: { turn: Turn }) {
  if (turn.kind === "design") {
    return (
      <Card className="flex flex-col gap-5 p-3 lg:p-4">
        <FirstScreens turn={turn} className="gap-2 lg:gap-3" loading="eager" />
        <div className="flex flex-wrap items-end justify-between gap-4 px-2 pb-2 lg:px-1 lg:pb-1">
          <UpNextFacts turn={turn} />
          <UpNextAction turn={turn} />
        </div>
      </Card>
    );
  }
  return (
    <Card className="grid items-center gap-5 p-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8 lg:p-4">
      <PreviewThumb url={turn.previewUrl} name={turn.businessName} />
      <div className="flex flex-col items-start gap-4 px-2 pb-2 lg:p-0">
        <UpNextFacts turn={turn} />
        <UpNextAction turn={turn} />
      </div>
    </Card>
  );
}

/** Everything else that waits, one row each, in the order to take it. */
export function TurnList({ turns }: { turns: Turn[] }) {
  return (
    <Card>
      <ul className="divide-ink/8 divide-y">
        {turns.map((turn) => (
          <li key={`${turn.kind}:${turn.id}`}>
            <Link
              href={turn.href}
              className="hover:bg-paper-shade/50 focus-visible:outline-ink flex min-h-16 items-center gap-4 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              {turn.kind === "design" && <FirstScreens turn={turn} className="w-32 shrink-0 gap-1 max-sm:hidden" />}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium">{turn.businessName}</span>
                <TurnMark turn={turn} />
              </span>
              <span className="text-ink-faint shrink-0 text-sm max-sm:hidden">
                <When date={turn.since} />
              </span>
              <CaretRight size={16} weight="bold" className="text-ink-faint shrink-0" aria-hidden="true" />
              <span className="sr-only">: {ACTION[turn.kind].toLowerCase()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
