import { redirect } from "next/navigation";

/** Moved under Sites; old links in emails and bot flags still land here. */
export default async function Moved({ params }: { params: Promise<{ slug: string }> }) {
  redirect(`/admin/sites/live/${encodeURIComponent((await params).slug)}`);
}
