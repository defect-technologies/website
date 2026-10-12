import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/Button";
import { siteName } from "@/server/editor/signInLinks";
import type { PortalContext } from "@/server/portal/context";
import { isLive } from "@/server/sites/clientSites";
import PortalTabs from "./PortalTabs";

function SitePicker({ context, path }: { context: PortalContext; path: string }) {
  if (context.sites.length < 2) return null;
  return (
    <nav aria-label="Your websites" className="flex flex-wrap gap-2">
      {context.sites.map((site) => {
        const current = site.slug === context.site.slug;
        return (
          <Link
            key={site.slug}
            href={`${path}?site=${encodeURIComponent(site.slug)}`}
            aria-current={current ? "page" : undefined}
            className={`min-h-9 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink ${current ? "bg-ink text-paper" : "bg-paper-shade text-ink-soft hover:text-ink"}`}
          >
            {siteName(site.businessName, site.url)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Every signed-in portal page: the logo, the sections, and the way into the editor. */
export default function PortalShell({ context, path, children }: { context: PortalContext; path: string; children: ReactNode }) {
  const several = context.sites.length > 1;
  return (
    <>
      <header className="border-ink/8 border-b">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-8">
          <Link href="/" className="font-script text-ink rounded-md px-1 text-3xl leading-[1.4] focus-visible:outline-2 focus-visible:outline-ink">
            defect.tech
          </Link>
          <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
            <PortalTabs site={several ? context.site.slug : undefined} />
          </div>
          {/* A plain link, not next/link: prefetching would open the editor in the background. The editor lives on the website, so it opens once it's live. */}
          {isLive(context.site) && (
            <a href={`/portal/edit/${context.site.slug}`} className={buttonClasses("solid", "md", "ms-auto sm:ms-0")}>
              <PencilSimple size={20} weight="bold" aria-hidden="true" />
              Edit website
            </a>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-20 sm:px-8">
        <SitePicker context={context} path={path} />
        {children}
      </main>
    </>
  );
}
