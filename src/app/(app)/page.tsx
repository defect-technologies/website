import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Composer from "@/components/Composer";
import Timeline from "@/components/Timeline";
import type { Circle, Group } from "@/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("circle_memberships")
    .select("circle_id, circles(*)")
    .eq("user_id", user.id);

  const circles = (memberships?.map((m) => (m as unknown as { circles: Circle }).circles).filter(Boolean) || []) as Circle[];
  const circleIds = circles.map((c) => c.id);

  const { data: ownedGroups } = await supabase
    .from("groups")
    .select("*")
    .eq("owner_id", user.id);

  const { data: groupMemberships } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  const { data: acceptedFollows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .eq("status", "accepted");

  const followedIds = (acceptedFollows || []).map((f) => f.following_id);

  const groups = (ownedGroups || []) as Group[];
  const allGroupIds = [
    ...groups.map((g) => g.id),
    ...(groupMemberships || []).map((m) => m.group_id),
  ];
  const uniqueGroupIds = [...new Set(allGroupIds)];

  const orClauses = [
    `author_id.eq.${user.id}`,
    `visibility.eq.public`,
  ];
  if (followedIds.length > 0) {
    orClauses.push(`and(visibility.eq.public,author_id.in.(${followedIds.join(",")}))`);
  }
  if (circleIds.length > 0) {
    orClauses.push(`and(visibility.eq.circle,circle_id.in.(${circleIds.join(",")}))`);
  }
  if (uniqueGroupIds.length > 0) {
    orClauses.push(`and(visibility.eq.group,group_id.in.(${uniqueGroupIds.join(",")}))`);
  }

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select(`
      *,
      author:users!posts_author_id_fkey(*),
      circle:circles(*),
      group:groups(*),
      media(*)
    `)
    .or(orClauses.join(","))
    .order("posted_at", { ascending: false })
    .limit(50);

  if (postsError) {
    console.error("Failed to fetch posts:", postsError);
  }

  const postsWithCounts = await Promise.all(
    (posts || []).map(async (post) => {
      const [{ data: reactions }, { count: commentCount }] = await Promise.all([
        supabase.from("reactions").select("type").eq("post_id", post.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      ]);

      return {
        ...post,
        reaction_counts: {
          thumbsup: reactions?.filter((r) => r.type === "thumbsup").length || 0,
          heart: reactions?.filter((r) => r.type === "heart").length || 0,
          thumbsdown: reactions?.filter((r) => r.type === "thumbsdown").length || 0,
        },
        comment_count: commentCount || 0,
      };
    })
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary mb-1">Your feed</h1>
        <p className="text-sm text-text-secondary">What&apos;s happening in your circles</p>
      </div>

      <Composer circles={circles} groups={groups} />
      <Timeline posts={postsWithCounts} currentUserId={user.id} />
    </div>
  );
}
