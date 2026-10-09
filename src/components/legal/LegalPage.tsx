import type { ReactNode } from "react";
import SiteFooter from "../SiteFooter";
import SiteNav from "../SiteNav";

export type LegalSection = { id: string; title: string; body: ReactNode };

type LegalPageProps = {
  title: string;
  effective: string;
  summary: [string, ReactNode][];
  sections: LegalSection[];
};

/** Long-form text styles, defined once for every legal page. */
const PROSE =
  "flex max-w-[68ch] flex-col gap-4 text-base leading-relaxed sm:text-lg [&_a]:underline [&_a]:decoration-ink/30 [&_a]:underline-offset-4 [&_a:hover]:decoration-ink [&_li]:pl-1 [&_strong]:font-semibold [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2 [&_ul]:pl-5";

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

function Contents({ sections }: { sections: LegalSection[] }) {
  return (
    <nav aria-label="Sections" className="hidden lg:block">
      <ol className="sticky top-28 flex flex-col gap-1 text-sm">
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="text-ink-soft hover:text-ink hover:bg-paper-shade block rounded-md px-2 py-1 focus-visible:outline-2 focus-visible:outline-ink">
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default function LegalPage({ title, effective, summary, sections }: LegalPageProps) {
  return (
    <>
      <SiteNav page="other" />
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-4 pt-32 pb-24 sm:px-8 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <Contents sections={sections} />
        <article className="flex min-w-0 flex-col gap-12">
          <header className="flex flex-col gap-4">
            <h1 className="font-display text-6xl leading-none font-black text-balance sm:text-7xl">{title}</h1>
            <p className="text-ink-soft">Effective {effective}</p>
          </header>
          <Summary rows={summary} />
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="flex scroll-mt-24 flex-col gap-4">
              <h2 className="text-2xl font-semibold text-balance">{section.title}</h2>
              <div className={PROSE}>{section.body}</div>
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
