import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import AddSiteForm from "@/components/admin/AddSiteForm";
import { PageHeader } from "@/components/admin/ui";
import { listBusinesses } from "@/server/leads/businesses";

export const metadata: Metadata = { title: "Add a site" };

export default async function AddSitePage() {
  const paid = await listBusinesses({ stage: "paid" });
  const clients = paid.map((business) => ({ id: business.id, name: business.businessName }));

  return (
    <>
      <Link href="/admin/sites" className="text-ink-soft hover:text-ink inline-flex w-fit items-center gap-1.5 text-sm">
        <ArrowLeft size={16} aria-hidden="true" /> Sites
      </Link>
      <PageHeader title="Add a site" />
      <AddSiteForm clients={clients} />
    </>
  );
}
