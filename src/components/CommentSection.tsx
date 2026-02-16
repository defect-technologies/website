"use client";

import { useState, useEffect } from "react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { PaperPlaneTilt, Eye, EyeSlash } from "@phosphor-icons/react";
import type { Comment } from "@/types";

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  currentUserId?: string;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function CommentSection({ postId, postAuthorId, currentUserId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<"author_only" | "public">("author_only");

  useEffect(() => {
    fetch(`/api/comments?postId=${postId}`)
      .then((res) => res.json())
      .then((data) => {
        setComments(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [postId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !currentUserId) return;
    setSubmitting(true);

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content: content.trim(), visibility }),
    });

    if (res.ok) {
      const newComment = await res.json();
      setComments((prev) => [...prev, newComment]);
      setContent("");
    }
    setSubmitting(false);
  }

  const isPostAuthor = currentUserId === postAuthorId;

  return (
    <div className="space-y-3 pt-3 border-t border-border/50">
      {loading ? (
        <p className="text-xs text-text-secondary">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-text-secondary">No comments yet</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="flex gap-2.5">
            <Avatar
              src={comment.author?.avatar_url}
              name={comment.author?.display_name || "User"}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">
                  {comment.author?.display_name}
                </span>
                <span className="text-xs text-text-secondary">{timeAgo(comment.created_at)}</span>
                {comment.visibility === "author_only" && (isPostAuthor || comment.author_id === currentUserId) && (
                  <span title="Only visible to you and the post author">
                    <EyeSlash size={12} className="text-text-secondary" />
                  </span>
                )}
              </div>
              <p className="text-sm text-text-primary/90 mt-0.5">{comment.content}</p>
            </div>
          </div>
        ))
      )}

      {currentUserId && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment..."
            maxLength={300}
            className="flex-1 text-sm rounded-md border border-border bg-background px-3 py-2 placeholder:text-text-secondary/50 focus:outline-none focus:ring-1 focus:ring-secondary/30"
          />
          <button
            type="button"
            onClick={() => setVisibility((v) => v === "author_only" ? "public" : "author_only")}
            className="p-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title={visibility === "author_only" ? "Only post author can see this (click to make public)" : "Visible to everyone (click to make private)"}
          >
            {visibility === "author_only" ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
          <Button type="submit" size="sm" loading={submitting} disabled={!content.trim()}>
            <PaperPlaneTilt size={14} />
          </Button>
        </form>
      )}
    </div>
  );
}
