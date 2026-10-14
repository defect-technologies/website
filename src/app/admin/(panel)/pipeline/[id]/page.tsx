import { redirect } from "next/navigation";

/** Lead pages moved under Leads; old links in emails and bot flags still land here. */
export default async function Moved({ params }: { params: Promise<{ id: string }> }) {
  redirect(`/admin/leads/${encodeURIComponent((await params).id)}`);
}
