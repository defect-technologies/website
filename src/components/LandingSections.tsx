import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { CLOSING, SAVINGS, WEBSITES } from "@/content/headlines";
import { DEFECT, FREELANCER, FREELANCER_SOURCE, YEARLY_PRICE, firstYear, priceRange, type PriceRow } from "@/content/pricing";
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
          We rebuild small-business websites that have fallen out of date, using the words and photos you already have.
        </p>
        <p className={BODY}>
          Then we keep yours current. When something changes, email us in plain English. It goes live the next business day,
          without you logging in to anything.
        </p>
      </div>
      <ScrapeReveal
        painted="/paint/sketch-painted.webp"
        revealed="/paint/sketch-built.webp"
        width={1200}
        height={800}
        alt="The homepage of Marigold Bakery, a made-up bakery: a large headline, an order button, and a picture of a loaf on yellow."
      />
    </section>
  );
}

function PriceCells({ row, emphasis }: { row: PriceRow; emphasis: boolean }) {
  const figure = emphasis ? "text-ink text-3xl font-semibold sm:text-4xl" : "text-ink-soft text-lg";
  return (
    <tr className="border-ink/10 border-t align-baseline">
      <th scope="row" className={`py-5 pr-6 text-left font-medium ${emphasis ? "text-ink text-lg" : "text-ink-soft"}`}>
        {row.who}
      </th>
      <td className={`py-5 pr-6 tabular-nums ${figure}`}>{priceRange(row.upFront)}</td>
      <td className={`py-5 pr-6 tabular-nums ${figure}`}>{priceRange(row.monthly)}</td>
      <td className={`py-5 tabular-nums ${figure}`}>{priceRange(firstYear(row))}</td>
    </tr>
  );
}

export function SavingsSection() {
  return (
    <section className={`${SECTION} flex flex-col gap-12`}>
      <PaintedHeadline as="h2" headline={SAVINGS} style={{ fontSize: "clamp(2.25rem, 7.5vw, 6rem)" }} />
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[34rem] border-collapse">
          <caption className="sr-only">What a small-business website costs</caption>
          <thead>
            <tr className="text-ink-soft text-left text-sm">
              <th scope="col" className="pb-3 font-normal">
                <span className="sr-only">Who builds it</span>
              </th>
              <th scope="col" className="pb-3 font-normal">Up front</th>
              <th scope="col" className="pb-3 font-normal">Each month</th>
              <th scope="col" className="pb-3 font-normal">First year</th>
            </tr>
          </thead>
          <tbody>
            <PriceCells row={FREELANCER} emphasis={false} />
            <PriceCells row={DEFECT} emphasis />
          </tbody>
        </table>
      </div>
      <p className={BODY}>
        The {priceRange(DEFECT.monthly)} a month covers hosting, security, backups, and every small change you email us. A
        whole year paid at once is {priceRange([YEARLY_PRICE, YEARLY_PRICE])}.
      </p>
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
