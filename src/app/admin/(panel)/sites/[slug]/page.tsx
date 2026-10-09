import { ArrowCounterClockwise, ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, Notice, When } from "@/components/admin/ui";
import { siteStore } from "@/server/sites/editing";
import { rollBackAction } from "../actions";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ added?: string; rolledBack?: string; rollBack?: string }> };

export const metadata: Metadata = { title: "Site history" };

export default async function SiteHistoryPage({ params, searchParams }: Props) {
  const site = await siteStore.site((await params).slug);
  if (!site) notFound();
  const [versions, query] = await Promise.all([siteStore.versions(site.slug), searchParams]);

  return (
    <>
      <Link href="/admin/sites" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" /> Sites
      </Link>
      <h1 className="font-display text-5xl leading-none font-black">{site.businessName}</h1>
      {query.added && (
        <Notice tone="good">
          Added. {site.ownerEmail} can sign in at defect.tech/edit/sign-in and edit it now.
        </Notice>
      )}
      {query.rolledBack && <Notice tone="good">Version {query.rolledBack} is live again. The owner sees this as a new version from Defect Technologies.</Notice>}
      {query.rollBack === "failed" && <Notice tone="bad">The site changed while you were looking, so nothing was rolled back. Reload and try again.</Notice>}
      <p className="text-ink-soft max-w-prose text-pretty">
        Rolling back restores the whole content.json from that version, photos and design included. Owners restoring from the editor only bring back the fields they can edit.
      </p>
      <Card>
        <ol className="divide-ink/8 flex flex-col divide-y">
          {versions.map((entry) => (
            <li key={entry.version} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-pretty">{entry.summary || `Version ${entry.version}`}</span>
                <span className="text-ink-faint text-sm">
                  Version {entry.version}, {entry.savedBy}, <When date={entry.savedAt} />
                </span>
              </div>
              {entry.version === site.version ? (
                <span className="bg-good/10 text-good rounded-full px-3 py-1 text-sm font-medium">Live now</span>
              ) : (
                <form action={rollBackAction}>
                  <input type="hidden" name="slug" value={site.slug} />
                  <input type="hidden" name="version" value={entry.version} />
                  <SubmitButton variant="soft" size="sm" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
                    Roll back to version {entry.version}
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
