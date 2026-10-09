import type { Metadata } from "next";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import { Card, PageHeader } from "@/components/admin/ui";
import { allClientSites } from "@/server/sites/clientSites";

export const metadata: Metadata = { title: "Sites" };

const addSiteLink = (
  <ButtonLink href="/admin/sites/new" size="sm" icon={<Plus size={16} weight="bold" aria-hidden="true" />}>
    Add a site
  </ButtonLink>
);

const hostOf = (url: string) => url.replace(/^https:\/\//, "");

export default async function SitesPage() {
  const sites = await allClientSites();

  return (
    <>
      <PageHeader title="Sites">{sites.length > 0 && addSiteLink}</PageHeader>
      {sites.length === 0 ? (
        <EmptyState title="No live sites yet" action={addSiteLink}>
          Add a client&apos;s site once it&apos;s live on site-kit, so its owner can get sign-in links to edit it.
        </EmptyState>
      ) : (
        <Card>
          <table className="w-full text-left text-sm">
            <thead className="text-ink-faint">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">Site</th>
                <th scope="col" className="px-5 py-3 font-medium">Owner</th>
                <th scope="col" className="px-5 py-3 font-medium">Client</th>
              </tr>
            </thead>
            <tbody className="divide-ink/8 divide-y">
              {sites.map((site) => (
                <tr key={site.slug}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/sites/${site.slug}`} className="font-medium hover:underline">
                      {hostOf(site.url)}
                    </Link>
                  </td>
                  <td className="text-ink-soft px-5 py-3">{site.ownerEmail}</td>
                  <td className="text-ink-soft px-5 py-3">{site.businessName ?? "Not linked"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
