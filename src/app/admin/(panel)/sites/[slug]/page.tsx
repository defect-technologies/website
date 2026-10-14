import { redirect } from "next/navigation";

/** Site pages moved under Clients. */
export default async function Moved({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/admin/clients/${encodeURIComponent((await params).slug)}`);
}
