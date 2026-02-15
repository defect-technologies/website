"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ReactionBar from "@/components/ReactionBar";
import { ChatCircle, DotsThree, FileText, Trash } from "@phosphor-icons/react";
import DropdownMenu, { DropdownItem } from "@/components/ui/DropdownMenu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Post } from "@/types";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getFileName(url: string) {
  const rawName = url.split("?")[0]?.split("/").pop() || "file";
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

export default function PostCard({ post, currentUserId, onDelete }: PostCardProps) {
  const supabase = createClient();
  const router = useRouter();
  const isOwner = currentUserId === post.author_id;

  async function handleDelete() {
    await supabase.from("posts").delete().eq("id", post.id);
    onDelete?.(post.id);
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/${post.author?.username}`}>
            <Avatar
              src={post.author?.avatar_url}
              name={post.author?.display_name || "User"}
              size="md"
            />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/${post.author?.username}`}
                className="text-sm font-medium text-text-primary hover:underline"
              >
                {post.author?.display_name}
              </Link>
              <span className="text-xs text-text-secondary">{timeAgo(post.posted_at)}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {post.circle && (
                <Link href={`/c/${post.circle.id}`}>
                  <Badge>{post.circle.name}</Badge>
                </Link>
              )}
              {isOwner && post.visibility === "group" && post.group && (
                <Badge>
                  <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: post.group.color }} />
                  {post.group.name}
                </Badge>
              )}
              {post.visibility !== "circle" && post.visibility !== "group" && (
                <Badge variant={post.visibility === "public" ? "success" : "default"}>
                  {post.visibility}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {isOwner && (
          <DropdownMenu
            trigger={
              <button className="text-text-secondary hover:text-text-primary p-1 cursor-pointer">
                <DotsThree size={20} weight="bold" />
              </button>
            }
            align="right"
          >
            <DropdownItem onClick={handleDelete} destructive>
              <span className="flex items-center gap-2">
                <Trash size={16} /> Delete post
              </span>
            </DropdownItem>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-3">
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{post.content}</p>
      </div>

      {post.media && post.media.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {post.media.map((m) => {
            if (m.type === "image") {
              return (
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  className="rounded-md max-h-64 object-cover"
                />
              );
            }

            if (m.type === "video") {
              return (
                <video
                  key={m.id}
                  src={m.url}
                  className="rounded-md max-h-64"
                  controls
                />
              );
            }

            return (
              <a
                key={m.id}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-text-secondary hover:text-text-primary transition-colors max-w-[220px]"
              >
                <FileText size={18} />
                <span className="truncate">{getFileName(m.url)}</span>
              </a>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <ReactionBar
          postId={post.id}
          counts={post.reaction_counts || { thumbsup: 0, heart: 0, thumbsdown: 0 }}
          userReaction={null}
        />
        <Link
          href={`/c/${post.circle_id}#post-${post.id}`}
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <ChatCircle size={16} />
          {post.comment_count ? `${post.comment_count}` : ""}
        </Link>
      </div>

      {post.total_score > 0 && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>Score: <strong className="text-secondary">{Math.round(post.total_score)}</strong></span>
            {post.ai_score > 0 && <span>AI: {Math.round(post.ai_score)}</span>}
            {post.novelty_score > 0 && <span>Novelty: {Math.round(post.novelty_score)}</span>}
          </div>
        </div>
      )}
    </motion.div>
  );
}
