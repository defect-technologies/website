import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradePost } from "@/lib/grader";
import { calculateNoveltyScore, calculateEngagementScore, calculateTotalScore } from "@/lib/scoring";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { postId } = await request.json();

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .single();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // AI Score
  const { score: aiScore, reasoning } = await gradePost(post.content);

  // Novelty Score — compare against recent posts in same circle
  let recentPosts: string[] = [];
  if (post.circle_id) {
    const { data: recent } = await supabase
      .from("posts")
      .select("content")
      .eq("circle_id", post.circle_id)
      .neq("id", postId)
      .order("posted_at", { ascending: false })
      .limit(20);

    recentPosts = (recent || []).map((p) => p.content);
  }
  const noveltyScore = calculateNoveltyScore(post.content, recentPosts);

  // Engagement Score
  const { data: reactions } = await supabase
    .from("reactions")
    .select("type")
    .eq("post_id", postId);

  const { data: comments } = await supabase
    .from("comments")
    .select("id")
    .eq("post_id", postId);

  const engagementScore = calculateEngagementScore(reactions || [], comments?.length || 0);

  // Total
  const totalScore = calculateTotalScore(aiScore, noveltyScore, engagementScore, post.is_flagged);

  // Update post
  await supabase
    .from("posts")
    .update({
      ai_score: aiScore,
      novelty_score: noveltyScore,
      engagement_score: engagementScore,
      total_score: totalScore,
    })
    .eq("id", postId);

  return NextResponse.json({
    aiScore,
    noveltyScore,
    engagementScore,
    totalScore,
    reasoning,
  });
}
