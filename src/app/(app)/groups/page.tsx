import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import GroupsPageClient from "@/components/GroupsPageClient";

export default async function GroupsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const groupsWithMembers = await Promise.all(
    (groups || []).map(async (group) => {
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id, users(*)")
        .eq("group_id", group.id);

      return {
        ...group,
        members: (members || []).map((m) => (m as unknown as { users: Record<string, unknown> }).users),
      };
    })
  );

  return <GroupsPageClient groups={groupsWithMembers} userId={user.id} />;
}
