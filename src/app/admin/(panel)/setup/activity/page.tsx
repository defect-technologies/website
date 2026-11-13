import { requireFounder } from "@/server/auth/session";
import type { Metadata } from "next";
import ActivitySheet from "@/components/admin/overview/ActivitySheet";
import { PageHeader } from "@/components/admin/ui";
import { recentActivity } from "@/server/overview";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage() {
  await requireFounder();
  const rows = await recentActivity();
  return (
    <>
      <PageHeader title="Activity log" />
      <ActivitySheet rows={rows} />
    </>
  );
}
