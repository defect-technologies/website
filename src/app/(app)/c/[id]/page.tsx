import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { Circle, LeaderboardEntry } from "@/types";
import CirclePageClient from "@/components/CirclePageClient";
import CreateCircleClient from "@/components/CreateCircleClient";

interface CirclePageProps {
  params: Promise<{ id: string }>;
}

export default async function CirclePage({ params }: CirclePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (id === "new") {
    return (
      <div className="max-w-md mx-auto">
        <h1 className="font-serif text-2xl font-bold text-text-primary mb-6">Create a circle</h1>
        <CreateCircleClient />
      </div>
    );
  }

  const { data: circle } = await supabase
    .from("circles")
    .select("*")
    .eq("id", id)
    .single();

  if (!circle) notFound();

  const { data: membership } = await supabase
    .from("circle_memberships")
    .select("*")
    .eq("circle_id", id)
    .eq("user_id", user.id)
    .single();

  const isMember = !!membership;
  const isAdmin = membership?.role === "admin";

  const { data: leaderboardData } = await supabase
    .from("circle_memberships")
    .select("user_id, points_this_week, points_this_month, users(username, display_name, avatar_url)")
    .eq("circle_id", id)
    .order("points_this_week", { ascending: false })
    .limit(10);

  const leaderboard: LeaderboardEntry[] = (leaderboardData || []).map((entry, i) => {
    const u = (entry as unknown as { users: { username: string; display_name: string; avatar_url: string | null } }).users;
    return {
      user_id: entry.user_id,
      username: u?.username || "",
      display_name: u?.display_name || "",
      avatar_url: u?.avatar_url || null,
      points: entry.points_this_week,
      rank: i + 1,
      post_count: 0,
    };
  });

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("*, author:users!posts_author_id_fkey(*), circle:circles(*), media(*)")
    .eq("circle_id", id)
    .order("posted_at", { ascending: false })
    .limit(50);

  if (postsError) {
    console.error("Failed to fetch circle posts:", postsError);
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

  const { data: userMemberships } = await supabase
    .from("circle_memberships")
    .select("circles(*)")
    .eq("user_id", user.id);

  const userCircles = (userMemberships?.map((m) => (m as unknown as { circles: Circle }).circles).filter(Boolean) || []) as Circle[];

  return (
    <CirclePageClient
      circle={circle}
      posts={postsWithCounts}
      leaderboard={leaderboard}
      userCircles={userCircles}
      currentUserId={user.id}
      isMember={isMember}
      isAdmin={isAdmin}
    />
  );
}
