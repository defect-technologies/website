/** The owner's actual new site, live and scrollable, in a browser window addressed to their own domain. */
export default function SitePreviewFrame({ previewUrl, businessName, domain }: { previewUrl: string; businessName: string; domain: string }) {
  return (
    <figure className="bg-surface shadow-lifted overflow-hidden rounded-2xl">
      <div className="bg-paper-shade flex h-9 items-center gap-3 px-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="bg-ink/15 size-2.5 rounded-full" />
          <span className="bg-ink/15 size-2.5 rounded-full" />
          <span className="bg-ink/15 size-2.5 rounded-full" />
        </span>
        <span className="bg-surface text-ink-soft min-w-0 flex-1 truncate rounded-full px-3 py-0.5 text-center text-sm">{domain}</span>
      </div>
      {/* Phones see the site at their own width; larger screens see the desktop layout at half size. */}
      <div className="relative h-[34rem] overflow-hidden sm:aspect-[16/10] sm:h-auto">
        <iframe
          src={previewUrl}
          title={`${businessName}'s new website`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
          className="absolute inset-0 size-full border-0 sm:h-[200%] sm:w-[200%] sm:origin-top-left sm:scale-50"
        />
      </div>
    </figure>
  );
}
