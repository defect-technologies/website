import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { CLOSING, SAVINGS, WEBSITES } from "@/content/headlines";
import { DEFECT, FREELANCER, FREELANCER_SOURCE, firstYear, priceRange, type PriceRow } from "@/content/pricing";
import { ButtonLink } from "./Button";
import PaintedHeadline from "./PaintedHeadline";
import ScrapeReveal from "./ScrapeReveal";

const SECTION = "mx-auto w-full max-w-6xl px-4 py-[14vh] sm:px-8";
const BODY = "text-ink-soft max-w-[36ch] text-lg leading-relaxed text-pretty";

export function WebsitesSection() {
  return (
    <section className={`${SECTION} grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]`}>
      <div className="flex flex-col gap-8">
        <PaintedHeadline as="h2" headline={WEBSITES} style={{ fontSize: "clamp(3rem, 9vw, 7rem)" }} />
        <p className={BODY}>
          We rebuild small-business websites. When something changes, email us and we&rsquo;ll have it up by the next business
          day.
        </p>
      </div>
      <ScrapeReveal
        painted="/paint/sketch-painted.webp"
        revealed="/paint/sketch-built.webp"
        width={1200}
        height={800}
        alt="An example homepage for a bakery."
      />
    </section>
  );
}

const PRICE_COLUMNS: { label: string; figure: (row: PriceRow) => [number, number] }[] = [
  { label: "Up front", figure: (row) => row.upFront },
  { label: "Each month", figure: (row) => row.monthly },
  { label: "First year", figure: firstYear },
];

const figureClass = (emphasis: boolean) => (emphasis ? "text-ink text-3xl font-semibold sm:text-4xl" : "text-ink-soft text-lg");

function PriceCells({ row, emphasis }: { row: PriceRow; emphasis: boolean }) {
  return (
    <tr className="border-ink/10 border-t align-baseline">
      <th scope="row" className={`py-5 pr-6 text-left font-medium ${emphasis ? "text-ink text-lg" : "text-ink-soft"}`}>
        {row.who}
      </th>
      {PRICE_COLUMNS.map((column) => (
        <td key={column.label} className={`py-5 pr-6 tabular-nums last:pr-0 ${figureClass(emphasis)}`}>
          {priceRange(column.figure(row))}
        </td>
      ))}
    </tr>
  );
}

function PriceTable() {
  return (
    <table className="hidden w-full border-collapse sm:table">
      <caption className="sr-only">What a small-business website costs</caption>
      <thead>
        <tr className="text-ink-soft text-left text-sm">
          <th scope="col" className="pb-3 font-normal">
            <span className="sr-only">Who builds it</span>
          </th>
          {PRICE_COLUMNS.map((column) => (
            <th key={column.label} scope="col" className="pb-3 font-normal">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <PriceCells row={FREELANCER} emphasis={false} />
        <PriceCells row={DEFECT} emphasis />
      </tbody>
    </table>
  );
}

/** On a phone the table's four columns don't fit, so each builder gets its own block with the same three figures. */
function PriceStack() {
  return (
    <div className="flex flex-col sm:hidden">
      {[
        { row: FREELANCER, emphasis: false },
        { row: DEFECT, emphasis: true },
      ].map(({ row, emphasis }) => (
        <section key={row.who} className="border-ink/10 flex flex-col gap-3 border-t py-5">
          <h3 className={`font-medium ${emphasis ? "text-ink text-lg" : "text-ink-soft"}`}>{row.who}</h3>
          <dl className="flex flex-col gap-2">
            {PRICE_COLUMNS.map((column) => (
              <div key={column.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-ink-soft text-sm">{column.label}</dt>
                <dd className={`text-right tabular-nums ${emphasis ? "text-ink text-2xl font-semibold" : "text-ink-soft text-lg"}`}>{priceRange(column.figure(row))}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function SavingsSection() {
  return (
    <section className={`${SECTION} flex flex-col gap-12`}>
      <PaintedHeadline as="h2" headline={SAVINGS} style={{ fontSize: "clamp(2.25rem, 7.5vw, 6rem)" }} />
      <div>
        <PriceTable />
        <PriceStack />
      </div>
      <p className={BODY}>Hosting and every change you send us are included.</p>
      <p className="text-ink-soft text-sm">
        Freelancer prices come from{" "}
        <a className="decoration-ink/30 hover:decoration-ink underline underline-offset-4" href={FREELANCER_SOURCE.href}>
          {FREELANCER_SOURCE.label}
        </a>
        .
      </p>
    </section>
  );
}

export function Closing() {
  return (
    <section className={`${SECTION} flex flex-col items-center gap-12 pb-[20vh] text-center`}>
      <PaintedHeadline as="h2" headline={CLOSING} style={{ fontSize: "clamp(1.75rem, 6vw, 5rem)" }} />
      <ButtonLink href="/team" icon={<ArrowRight size={20} weight="bold" aria-hidden="true" />}>
        Meet the team
      </ButtonLink>
    </section>
  );
}
