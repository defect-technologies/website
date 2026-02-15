import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("circle_memberships")
    .select("circle_id, role, circles(*)")
    .eq("user_id", user.id);

  const circles = memberships?.map((m) => (m as unknown as { circles: Record<string, unknown> }).circles).filter(Boolean) || [];
  const circleIds = (circles as { id: string }[]).map((c) => c.id);

  const [{ count: pendingFollowCount }, { count: unreadNotificationCount }] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", user.id)
      .eq("status", "pending"),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
  ]);

  let unseenCounts: Record<string, number> = {};
  if (circleIds.length > 0) {
    const { data: lastSeenRows } = await supabase
      .from("circle_last_seen")
      .select("circle_id, last_seen_at")
      .eq("user_id", user.id)
      .in("circle_id", circleIds);

    const lastSeenMap: Record<string, string> = {};
    (lastSeenRows || []).forEach((row) => {
      lastSeenMap[row.circle_id] = row.last_seen_at;
    });

    const counts = await Promise.all(
      circleIds.map(async (cid) => {
        const lastSeen = lastSeenMap[cid];
        let query = supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("circle_id", cid)
          .eq("visibility", "circle");

        if (lastSeen) {
          query = query.gt("posted_at", lastSeen);
        }

        const { count } = await query;
        return { id: cid, count: count || 0 };
      })
    );

    counts.forEach(({ id, count }) => {
      if (count > 0) unseenCounts[id] = count;
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto flex">
        <Sidebar
          user={profile}
          circles={circles as never[]}
          unseenCounts={unseenCounts}
          pendingFollowCount={pendingFollowCount || 0}
          unreadNotificationCount={unreadNotificationCount || 0}
        />
        <main className="flex-1 min-h-screen border-x border-border/50 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
