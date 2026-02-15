import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { LeaderboardEntry } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const { searchParams } = request.nextUrl;
  const period = searchParams.get("period") || "week";
  const pointsColumn = period === "month" ? "points_this_month" : "points_this_week";

  const { data, error } = await supabase
    .from("circle_memberships")
    .select(`
      user_id,
      points_this_week,
      points_this_month,
      users(username, display_name, avatar_url)
    `)
    .eq("circle_id", id)
    .order(pointsColumn, { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get post counts
  const entries: LeaderboardEntry[] = await Promise.all(
    (data || []).map(async (entry, i) => {
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("author_id", entry.user_id)
        .eq("circle_id", id)
        .gte("posted_at", period === "month"
          ? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
          : getStartOfWeek().toISOString()
        );

      const u = (entry as unknown as { users: { username: string; display_name: string; avatar_url: string | null } }).users;

      return {
        user_id: entry.user_id,
        username: u?.username || "",
        display_name: u?.display_name || "",
        avatar_url: u?.avatar_url || null,
        points: period === "month" ? entry.points_this_month : entry.points_this_week,
        rank: i + 1,
        post_count: count || 0,
      };
    })
  );

  return NextResponse.json(entries);
}

function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}
