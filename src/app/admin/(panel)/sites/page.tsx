import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { Card, PageHeader, When } from "@/components/admin/ui";
import { siteStore } from "@/server/sites/editing";

export const metadata: Metadata = { title: "Sites" };

export default async function SitesPage() {
  const sites = await siteStore.allSites();

  return (
    <>
      <PageHeader title="Sites" />
      {sites.length === 0 ? (
        <EmptyState title="No live sites yet">Each client&apos;s content.json shows up here once their site is added, with every change owners and we make to it.</EmptyState>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Site</th>
                <th scope="col" className="px-5 py-3 font-medium">Owner</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Version</th>
                <th scope="col" className="px-5 py-3 font-medium">Last change</th>
              </tr>
            </thead>
            <tbody className="divide-ink/8 divide-y">
              {sites.map((site) => (
                <tr key={site.slug}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/sites/${site.slug}`} className="font-medium hover:underline">
                      {site.businessName}
                    </Link>
                  </td>
                  <td className="text-ink-soft px-5 py-3">{site.ownerEmail}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{site.version}</td>
                  <td className="text-ink-soft px-5 py-3">
                    {site.updatedBy}, <When date={site.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
