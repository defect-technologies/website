import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { INCLUDED, QUESTIONS } from "@/content/welcome";

export function IncludedList() {
  return (
    <dl className="flex flex-col">
      {INCLUDED.map((item) => (
        <div key={item.title} className="border-ink/10 grid gap-1 border-t py-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:gap-8">
          <dt className="text-ink text-lg font-semibold">{item.title}</dt>
          <dd className="text-ink-soft text-lg text-pretty">{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

export function QuestionList() {
  return (
    <div className="flex flex-col">
      {QUESTIONS.map((item) => (
        <details key={item.question} className="group border-ink/10 border-t">
          <summary className="text-ink hover:bg-paper-shade/60 focus-visible:outline-ink flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg px-2 py-3 text-lg font-semibold focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
            {item.question}
            <CaretDown size={20} weight="bold" aria-hidden="true" className="text-ink-soft shrink-0 transition-[rotate] duration-150 ease-knife group-open:rotate-180" />
          </summary>
          <p className="text-ink-soft max-w-[60ch] px-2 pb-5 text-lg text-pretty">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
