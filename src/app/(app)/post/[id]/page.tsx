import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import PostCard from "@/components/PostCard";

interface PostPageProps {
  params: Promise<{ id: string }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("posts")
    .select(`
      *,
      author:users!posts_author_id_fkey(*),
      circle:circles(*),
      group:groups(*),
      media(*)
    `)
    .eq("id", id)
    .single();

  if (!post) notFound();

  const canView = await checkAccess(supabase, post, user.id);
  if (!canView) notFound();

  const [{ data: reactions }, { count: commentCount }] = await Promise.all([
    supabase.from("reactions").select("type, user_id").eq("post_id", post.id),
    supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
  ]);

  const myReaction = reactions?.find((r) => r.user_id === user.id);

  const enrichedPost = {
    ...post,
    reaction_counts: {
      thumbsup: reactions?.filter((r) => r.type === "thumbsup").length || 0,
      heart: reactions?.filter((r) => r.type === "heart").length || 0,
      thumbsdown: reactions?.filter((r) => r.type === "thumbsdown").length || 0,
    },
    user_reaction: myReaction?.type || null,
    comment_count: commentCount || 0,
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Back to feed
      </Link>

      <PostCard post={enrichedPost} currentUserId={user.id} />
    </div>
  );
}

async function checkAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  post: { author_id: string; visibility: string; circle_id: string | null; group_id: string | null },
  userId: string
): Promise<boolean> {
  if (post.author_id === userId) return true;
  if (post.visibility === "public") return true;
  if (post.visibility === "personal") return false;

  if (post.visibility === "circle" && post.circle_id) {
    const { data } = await supabase
      .from("circle_memberships")
      .select("user_id")
      .eq("circle_id", post.circle_id)
      .eq("user_id", userId)
      .single();
    return !!data;
  }

  if (post.visibility === "group" && post.group_id) {
    const { data } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", post.group_id)
      .eq("user_id", userId)
      .single();
    return !!data;
  }

  return false;
}
