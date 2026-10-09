import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import { Card } from "@/components/admin/ui";
import EditorBrand from "@/components/editor/EditorBrand";
import { requireOwner } from "@/server/auth/ownerSession";
import { siteStore } from "@/server/sites/editing";

export const metadata: Metadata = { title: "Your sites" };

export default async function EditorHome() {
  const owner = await requireOwner();
  const owned = await siteStore.sitesFor(owner.email);
  if (owned.length === 1) redirect(`/edit/${owned[0].slug}`);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col items-center gap-8 px-4 py-12">
      <EditorBrand />
      {owned.length === 0 ? (
        <EmptyState title="There's no site on this account yet">
          We couldn&apos;t find a site for {owner.email}. If that&apos;s a surprise, email hello@defect.tech and we&apos;ll sort it out.
        </EmptyState>
      ) : (
        <Card className="flex w-full flex-col divide-y divide-ink/8">
          <h1 className="px-5 py-4 text-lg font-semibold">Pick a site to edit</h1>
          {owned.map((site) => (
            <div key={site.slug} className="flex items-center justify-between gap-4 px-5 py-4">
              <span className="font-medium">{site.businessName}</span>
              <ButtonLink href={`/edit/${site.slug}`} variant="soft" size="sm" icon={<ArrowRight size={16} aria-hidden="true" />}>
                Edit {site.businessName}
              </ButtonLink>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
