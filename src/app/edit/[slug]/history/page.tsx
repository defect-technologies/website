import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, Notice, When } from "@/components/admin/ui";
import EditorHeader from "@/components/editor/EditorHeader";
import { requireOwner } from "@/server/auth/ownerSession";
import { ownedSite, siteStore } from "@/server/sites/editing";
import type { VersionSummary } from "@/server/sites/store";
import { restoreVersionAction } from "../../actions";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ restored?: string; restore?: string }> };

export const metadata: Metadata = { title: "Earlier versions" };

/** One history holds everyone's changes; anything the owner didn't save came from our team. */
function who(savedBy: string, ownerEmail: string) {
  return savedBy === ownerEmail ? "You" : "Defect Technologies";
}

function VersionRow({ entry, slug, isCurrent, ownerEmail }: { entry: VersionSummary; slug: string; isCurrent: boolean; ownerEmail: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-pretty">{entry.summary || `Version ${entry.version}`}</span>
        <span className="text-ink-faint text-sm">
          Version {entry.version}, {who(entry.savedBy, ownerEmail)}, <When date={entry.savedAt} />
        </span>
      </div>
      {isCurrent ? (
        <span className="bg-good/10 text-good rounded-full px-3 py-1 text-sm font-medium">Live now</span>
      ) : (
        <form action={restoreVersionAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="version" value={entry.version} />
          <SubmitButton variant="soft" size="sm" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
            Restore version {entry.version}
          </SubmitButton>
        </form>
      )}
    </li>
  );
}

export default async function HistoryPage({ params, searchParams }: Props) {
  const owner = await requireOwner();
  const site = await ownedSite(owner, (await params).slug);
  if (!site) notFound();
  const [versions, query] = await Promise.all([siteStore.versions(site.slug), searchParams]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-6 pb-10 sm:px-6">
      <EditorHeader slug={site.slug} businessName={site.businessName} liveUrl={site.liveUrl} page="history" />
      {query.restored && <Notice tone="good">Version {query.restored} is back on your site. Restoring made a new version, so you can undo it the same way.</Notice>}
      {query.restore === "failed" && <Notice tone="bad">That version couldn&apos;t be restored. Reload the page and try again, or email hello@defect.tech.</Notice>}
      <p className="text-ink-soft text-pretty">
        This list has every change to your site, yours and ours. Restoring brings back the words, hours, contact details, and services from that version. Photos and design stay as they are now.
      </p>
      <Card>
        <ol className="divide-ink/8 flex flex-col divide-y">
          {versions.map((entry) => (
            <VersionRow key={entry.version} entry={entry} slug={site.slug} isCurrent={entry.version === site.version} ownerEmail={owner.email} />
          ))}
        </ol>
      </Card>
    </main>
  );
}
