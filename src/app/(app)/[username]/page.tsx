import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProfileHeader from "@/components/ProfileHeader";
import Timeline from "@/components/Timeline";
import CircleCard from "@/components/CircleCard";
import type { Circle, FollowStatus } from "@/types";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;

  // Skip reserved routes
  if (username === "settings") return null;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const isOwnProfile = currentUser?.id === profile.id;

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", profile.id)
      .eq("status", "accepted"),
    supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", profile.id)
      .eq("status", "accepted"),
  ]);

  let followStatus: FollowStatus = "none";
  if (currentUser && !isOwnProfile) {
    const { data: follow } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", currentUser.id)
      .eq("following_id", profile.id)
      .maybeSingle();

    if (follow) followStatus = follow.status as FollowStatus;
  }

  let postsQuery = supabase
    .from("posts")
    .select("*, author:users!posts_author_id_fkey(*), circle:circles(*), media(*)")
    .eq("author_id", profile.id)
    .order("posted_at", { ascending: false })
    .limit(50);

  if (!isOwnProfile) {
    const { data: viewerMemberships } = currentUser
      ? await supabase.from("circle_memberships").select("circle_id").eq("user_id", currentUser.id)
      : { data: [] };
    const viewerCircleIds = (viewerMemberships || []).map((m) => m.circle_id);

    const orClauses = [`visibility.eq.public`];
    if (viewerCircleIds.length > 0) {
      orClauses.push(`and(visibility.eq.circle,circle_id.in.(${viewerCircleIds.join(",")}))`);
    }
    postsQuery = postsQuery.or(orClauses.join(","));
  }

  const { data: posts, error: postsError } = await postsQuery;

  if (postsError) {
    console.error("Failed to fetch profile posts:", postsError);
  }

  const postsWithCounts = await Promise.all(
    (posts || []).map(async (post) => {
      const [{ data: reactions }, { count: commentCount }] = await Promise.all([
        supabase.from("reactions").select("type, user_id").eq("post_id", post.id),
        supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      ]);

      const myReaction = reactions?.find((r) => r.user_id === currentUser?.id);

      return {
        ...post,
        reaction_counts: {
          thumbsup: reactions?.filter((r) => r.type === "thumbsup").length || 0,
          heart: reactions?.filter((r) => r.type === "heart").length || 0,
          thumbsdown: reactions?.filter((r) => r.type === "thumbsdown").length || 0,
        },
        user_reaction: myReaction?.type || null,
        comment_count: commentCount || 0,
      };
    })
  );

  const { data: memberships } = await supabase
    .from("circle_memberships")
    .select("circles(*)")
    .eq("user_id", profile.id);

  const circles = (memberships?.map((m) => (m as unknown as { circles: Circle }).circles).filter(Boolean) || []) as Circle[];

  const totalPosts = posts?.length || 0;
  const avgScore = totalPosts > 0
    ? Math.round((posts || []).reduce((sum, p) => sum + (p.total_score || 0), 0) / totalPosts)
    : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="pb-6 mb-6 border-b border-border">
        <ProfileHeader
          profile={profile}
          currentUserId={currentUser?.id}
          followerCount={followerCount || 0}
          followingCount={followingCount || 0}
          followStatus={followStatus}
        />
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary font-serif">{totalPosts}</p>
          <p className="text-xs text-text-secondary">Posts</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary font-serif">{avgScore}</p>
          <p className="text-xs text-text-secondary">Avg score</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary font-serif">{circles.length}</p>
          <p className="text-xs text-text-secondary">Circles</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary font-serif">{followerCount || 0}</p>
          <p className="text-xs text-text-secondary">Followers</p>
        </div>
      </div>

      {circles.length > 0 && (
        <div className="mb-6">
          <h2 className="font-serif text-lg font-semibold text-text-primary mb-3">Circles</h2>
          <div className="grid grid-cols-2 gap-3">
            {circles.map((circle) => (
              <CircleCard key={circle.id} circle={circle} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-serif text-lg font-semibold text-text-primary mb-3">Timeline</h2>
        <Timeline posts={postsWithCounts} currentUserId={currentUser?.id} />
      </div>
    </div>
  );
}
