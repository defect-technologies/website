"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import type { Comment } from "@/types";

interface CommentSectionProps {
  postId: string;
  initialComments: Comment[];
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, author_id: user.id, content: content.trim() })
      .select("*, author:users(*)")
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setContent("");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2.5">
          <Avatar
            src={comment.author?.avatar_url}
            name={comment.author?.display_name || "User"}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-text-primary">
                {comment.author?.display_name}
              </span>
              <span className="text-xs text-text-secondary">{timeAgo(comment.created_at)}</span>
            </div>
            <p className="text-sm text-text-primary/90 mt-0.5">{comment.content}</p>
          </div>
        </div>
      ))}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          maxLength={300}
          className="flex-1 text-sm rounded-md border border-border bg-background px-3 py-2 placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-secondary/30"
        />
        <Button type="submit" size="sm" loading={loading} disabled={!content.trim()}>
          <PaperPlaneTilt size={14} />
        </Button>
      </form>
    </div>
  );
}
