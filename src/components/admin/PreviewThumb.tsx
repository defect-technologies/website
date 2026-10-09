import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";

/** The lead's preview at a quarter of desktop size. Opens the real thing in a new tab. */
export default function PreviewThumb({ url, name }: { url: string; name: string }) {
  if (!url) {
    return (
      <div className="bg-paper-shade text-ink-faint grid aspect-[8/5] w-full place-items-center rounded-xl text-sm">No preview yet</div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group relative block aspect-[8/5] w-full overflow-hidden rounded-xl bg-white outline outline-1 -outline-offset-1 outline-black/10 focus-visible:outline-2 focus-visible:outline-ink"
    >
      <span className="sr-only">Open {name}&apos;s preview in a new tab</span>
      <iframe
        src={url}
        title={`${name} preview`}
        aria-hidden="true"
        tabIndex={-1}
        loading="lazy"
        sandbox="allow-same-origin"
        className="pointer-events-none absolute top-0 left-0 h-[400%] w-[400%] origin-top-left scale-25 border-0"
      />
      <span className="bg-ink/70 text-paper absolute right-2 bottom-2 grid size-8 place-items-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <ArrowSquareOut size={16} weight="bold" aria-hidden="true" />
      </span>
    </a>
  );
}
