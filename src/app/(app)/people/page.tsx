import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PeoplePageClient from "@/components/PeoplePageClient";
import type { User, FollowStatus } from "@/types";

export default async function PeoplePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myMemberships } = await supabase
    .from("circle_memberships")
    .select("circle_id")
    .eq("user_id", user.id);

  const myCircleIds = (myMemberships || []).map((m) => m.circle_id);

  const { data: allUsers } = await supabase
    .from("users")
    .select("*")
    .neq("id", user.id)
    .order("joined_at", { ascending: false })
    .limit(100);

  const { data: follows } = await supabase
    .from("follows")
    .select("follower_id, following_id, status")
    .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

  const followStatusMap: Record<string, FollowStatus> = {};
  (follows || []).forEach((f) => {
    if (f.follower_id === user.id) {
      followStatusMap[f.following_id] = f.status as FollowStatus;
    }
  });

  let mutualCircleMap: Record<string, string[]> = {};
  if (myCircleIds.length > 0) {
    const { data: otherMemberships } = await supabase
      .from("circle_memberships")
      .select("user_id, circle_id, circles(name)")
      .in("circle_id", myCircleIds)
      .neq("user_id", user.id);

    (otherMemberships || []).forEach((m) => {
      const circleName = (m as unknown as { circles: { name: string } }).circles?.name;
      if (!mutualCircleMap[m.user_id]) mutualCircleMap[m.user_id] = [];
      if (circleName) mutualCircleMap[m.user_id].push(circleName);
    });
  }

  const usersWithCircleMembers = new Set(Object.keys(mutualCircleMap));
  const sortedUsers = ((allUsers || []) as User[]).sort((a, b) => {
    const aHasMutual = usersWithCircleMembers.has(a.id) ? 1 : 0;
    const bHasMutual = usersWithCircleMembers.has(b.id) ? 1 : 0;
    return bHasMutual - aHasMutual;
  });

  return (
    <PeoplePageClient
      users={sortedUsers}
      followStatusMap={followStatusMap}
      mutualCircleMap={mutualCircleMap}
      currentUserId={user.id}
    />
  );
}
