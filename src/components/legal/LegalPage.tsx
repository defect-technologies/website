import type { ReactNode } from "react";
import SiteFooter from "../SiteFooter";
import SiteNav from "../SiteNav";

export type LegalClause = { title: string; body: ReactNode };

/** A section is either free prose (`body`) or numbered clauses, which the page numbers as 4.1, 4.2 and so on. */
export type LegalSection = { id: string; title: string } & ({ body: ReactNode; clauses?: never } | { clauses: LegalClause[]; body?: never });

type LegalPageProps = {
  title: string;
  effective: string;
  /** Opening paragraphs that sit above the numbered sections, such as the parties and a notice. */
  preamble?: ReactNode;
  summary?: [string, ReactNode][];
  /** Number the sections and their clauses, as a contract does, so they can be cited. */
  numbered?: boolean;
  sections: LegalSection[];
};

/** Long-form text styles, defined once for every legal page. */
const PROSE =
  "flex max-w-[68ch] flex-col gap-4 text-base leading-relaxed [&_a]:underline [&_a]:decoration-ink/30 [&_a]:underline-offset-4 [&_a:hover]:decoration-ink [&_li]:pl-1 [&_strong]:font-semibold [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

/** A contract's lettered list: (a), (b), (c). */
export function Items({ children }: { children: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {children.map((item, index) => (
        <li key={index} className="grid grid-cols-[2rem_minmax(0,1fr)]">
          <span aria-hidden="true">({ALPHABET[index]})</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

/** Text the law wants a reader to notice, such as a disclaimer or a liability cap. */
export function Conspicuous({ children }: { children: ReactNode }) {
  return <p className="font-semibold">{children}</p>;
}

/** A defined term where it is defined: <Term>Client Content</Term> renders as "Client Content" in bold. */
export function Term({ children }: { children: ReactNode }) {
  return <strong>&ldquo;{children}&rdquo;</strong>;
}

function Summary({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="bg-surface shadow-card grid max-w-[68ch] gap-x-8 gap-y-3 rounded-2xl p-5 sm:grid-cols-[max-content_minmax(0,1fr)] sm:p-6">
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-semibold">{key}</dt>
          <dd className="text-ink-soft mb-2 text-pretty sm:mb-0 [&_a]:underline [&_a]:decoration-ink/30 [&_a]:underline-offset-4">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const sectionLabel = (section: LegalSection, index: number, numbered: boolean) => (numbered ? `${index + 1}. ${section.title}` : section.title);

function Contents({ sections, numbered, className }: { sections: LegalSection[]; numbered: boolean; className: string }) {
  return (
    <nav aria-label="Sections" className={className}>
      <ol className="flex flex-col gap-1 text-sm">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="text-ink-soft hover:text-ink hover:bg-paper-shade block rounded-md px-2 py-1 tabular-nums focus-visible:outline-2 focus-visible:outline-ink">
              {sectionLabel(section, index, numbered)}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Clauses({ sectionId, sectionNumber, clauses }: { sectionId: string; sectionNumber: number; clauses: LegalClause[] }) {
  return clauses.map((clause, index) => (
    <div key={clause.title} id={`${sectionId}-${index + 1}`} className="flex scroll-mt-24 flex-col gap-3">
      <h3 className="font-semibold tabular-nums">
        {sectionNumber}.{index + 1} {clause.title}
      </h3>
      {clause.body}
    </div>
  ));
}

function Section({ section, index, numbered }: { section: LegalSection; index: number; numbered: boolean }) {
  return (
    <section id={section.id} className="border-ink/10 flex scroll-mt-24 flex-col gap-5 border-t pt-8">
      <h2 className="text-xl font-semibold text-balance tabular-nums">{sectionLabel(section, index, numbered)}</h2>
      <div className={PROSE}>{section.clauses ? <Clauses sectionId={section.id} sectionNumber={index + 1} clauses={section.clauses} /> : section.body}</div>
    </section>
  );
}

export default function LegalPage({ title, effective, preamble, summary, numbered = false, sections }: LegalPageProps) {
  return (
    <>
      <SiteNav page="other" />
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 pt-32 pb-24 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <Contents sections={sections} numbered={numbered} className="hidden lg:block [&>ol]:sticky [&>ol]:top-28" />
        <article className="flex max-w-[68ch] min-w-0 flex-col gap-10">
          <header className="border-ink flex flex-col gap-3 border-b-2 pb-6">
            <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{title}</h1>
            <p className="text-ink-soft">Last updated {effective}</p>
          </header>
          {preamble && <div className={PROSE}>{preamble}</div>}
          {summary && <Summary rows={summary} />}
          <Contents sections={sections} numbered={numbered} className="bg-surface shadow-card max-w-[68ch] rounded-2xl p-3 lg:hidden" />
          {sections.map((section, index) => (
            <Section key={section.id} section={section} index={index} numbered={numbered} />
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
