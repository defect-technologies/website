import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EditorHeader from "@/components/editor/EditorHeader";
import SiteEditor from "@/components/editor/SiteEditor";
import { editableFrom } from "@/lib/siteContent";
import { requireOwner } from "@/server/auth/ownerSession";
import { ownedSite } from "@/server/sites/editing";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Edit your site" };

export default async function EditSitePage({ params }: Params) {
  const owner = await requireOwner();
  const site = await ownedSite(owner, (await params).slug);
  if (!site) notFound();

  return (
    <main className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 px-4 pt-6 pb-10 sm:px-6">
      <EditorHeader slug={site.slug} businessName={site.businessName} liveUrl={site.liveUrl} page="editor" />
      <SiteEditor
        slug={site.slug}
        content={site.content}
        editable={editableFrom(site.content)}
        version={site.version}
        assetBaseUrl={site.assetBaseUrl}
        liveUrl={site.liveUrl}
      />
    </main>
  );
}
