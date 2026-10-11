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

/** A disclosure table. On a phone it scrolls sideways, and the clipped column shows there's more. */
export function Table({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm leading-normal">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-ink border-b-2">
            {head.map((label) => (
              <th key={label} scope="col" className="py-2 pr-4 align-bottom font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-ink/10 divide-y">
          {rows.map((cells, row) => (
            <tr key={row}>
              {cells.map((cell, column) => {
                const Cell = column === 0 ? "th" : "td";
                return (
                  <Cell key={column} scope={column === 0 ? "row" : undefined} className={`py-3 pr-4 align-top ${column === 0 ? "font-semibold" : "text-ink-soft"}`}>
                    {cell}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sections are numbered, as a contract's are, so they can be cited. */
const sectionLabel = (section: LegalSection, index: number) => `${index + 1}. ${section.title}`;

function Contents({ sections, className }: { sections: LegalSection[]; className: string }) {
  return (
    <nav aria-label="Sections" className={className}>
      <ol className="flex flex-col gap-1 text-sm">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="text-ink-soft hover:text-ink hover:bg-paper-shade block rounded-md px-2 py-1 tabular-nums focus-visible:outline-2 focus-visible:outline-ink">
              {sectionLabel(section, index)}
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

function Section({ section, index }: { section: LegalSection; index: number }) {
  return (
    <section id={section.id} className="border-ink/10 flex scroll-mt-24 flex-col gap-5 border-t pt-8">
      <h2 className="text-xl font-semibold text-balance tabular-nums">{sectionLabel(section, index)}</h2>
      <div className={PROSE}>{section.clauses ? <Clauses sectionId={section.id} sectionNumber={index + 1} clauses={section.clauses} /> : section.body}</div>
    </section>
  );
}

export default function LegalPage({ title, effective, preamble, sections }: LegalPageProps) {
  return (
    <>
      <SiteNav page="other" />
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 pt-32 pb-24 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <Contents sections={sections} className="hidden lg:block [&>ol]:sticky [&>ol]:top-28" />
        <article className="flex max-w-[68ch] min-w-0 flex-col gap-10">
          <header className="border-ink flex flex-col gap-3 border-b-2 pb-6">
            <h1 className="text-4xl font-semibold text-balance sm:text-5xl">{title}</h1>
            <p className="text-ink-soft">Effective date: {effective}</p>
          </header>
          {preamble && <div className={PROSE}>{preamble}</div>}
          <Contents sections={sections} className="bg-surface shadow-card max-w-[68ch] rounded-2xl p-3 lg:hidden" />
          {sections.map((section, index) => (
            <Section key={section.id} section={section} index={index} />
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
