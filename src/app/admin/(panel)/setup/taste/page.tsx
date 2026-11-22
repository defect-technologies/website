import { redirect } from "next/navigation";

/** Each founder's taste is on their own row of Designers. */
export default async function Moved({ searchParams }: { searchParams: Promise<{ founder?: string }> }) {
  const { founder } = await searchParams;
  redirect(founder ? `/admin/setup/designers/founder/${encodeURIComponent(founder.toLowerCase())}` : "/admin/setup/designers");
}
