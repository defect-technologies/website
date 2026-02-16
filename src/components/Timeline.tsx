"use client";

import PostCard from "@/components/PostCard";
import type { Post } from "@/types";

interface TimelineProps {
  posts: Post[];
  currentUserId?: string;
  isProfile?: boolean;
}

function groupByDay(posts: Post[]) {
  const groups: { date: string; label: string; posts: Post[] }[] = [];
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  for (const post of posts) {
    const postDate = new Date(post.posted_at).toDateString();
    let label = new Date(post.posted_at).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (postDate === today) label = "Today";
    if (postDate === yesterday) label = "Yesterday";

    const existing = groups.find((g) => g.date === postDate);
    if (existing) {
      existing.posts.push(post);
    } else {
      groups.push({ date: postDate, label, posts: [post] });
    }
  }

  return groups;
}

export default function Timeline({ posts, currentUserId, isProfile }: TimelineProps) {
  const groups = groupByDay(posts);

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-text-secondary text-sm">No posts yet. Be the first to share something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.date}>
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              {group.label}
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="space-y-3">
            {group.posts.map((post, index) => (
              <PostCard key={`${post.id}-${index}`} post={post} currentUserId={currentUserId} showUser={!isProfile || index == 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
