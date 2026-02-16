"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ReactionBar from "@/components/ReactionBar";
import CommentSection from "@/components/CommentSection";
import { ChatCircle, DotsThree, FileText, Trash } from "@phosphor-icons/react";
import DropdownMenu, { DropdownItem } from "@/components/ui/DropdownMenu";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { Post } from "@/types";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
  showUser?: boolean;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@") && part.length > 1) {
          const username = part.slice(1);
          return (
            <Link
              key={i}
              href={`/${username}`}
              className="text-accent font-medium hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function getFileName(url: string) {
  const rawName = url.split("?")[0]?.split("/").pop() || "file";
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function getRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  const normalized = ((hash % 100) / 100);
  return normalized * 0.6 + 0.3 * (hash > 0 ? 1 : -1);
}

export default function PostCard({ post, currentUserId, onDelete, showUser = true }: PostCardProps) {
  const supabase = createClient();
  const router = useRouter();
  const isOwner = currentUserId === post.author_id;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const rotation = getRotation(post.id);

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
      className="relative rounded-sm p-4"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <div className="flex items-start justify-between">
        {showUser ?
          <div className="flex items-center gap-2">
            <Link href={`/${post.author?.username}`}>
              <Avatar
                src={post.author?.avatar_url}
                name={post.author?.display_name || "User"}
                size="xs"
              />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/${post.author?.username}`}
                  className="text-sm font-medium text-text-secondary hover:underline"
                >
                  {post.author?.display_name}
                </Link>
                <span className="text-xs text-text-secondary">{timeAgo(post.posted_at)}</span>
              </div>
            </div>
          </div>
          :
          <span className="ml-3 text-xs text-text-secondary">{timeAgo(post.posted_at)}</span>
        }

        {!showUser && (
          <div className="absolute -top-3 left-4 w-px bg-secondary/50 h-12 pointer-events-none"></div>
        )}


        <div className="flex flex-row gap-2">
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
              {post.visibility ? post.visibility.charAt(0).toUpperCase() + post.visibility.slice(1) : "Unknown"}
            </Badge>
          )}
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
      </div>

      <div
        className="mt-1 cursor-pointer"
        onClick={() => {
          window.location.href = `/post/${post.id}`;
        }}
      >
        <p className="text-lg text-text-primary whitespace-pre-wrap leading-relaxed font-serif">
          <MentionText text={post.content} />
        </p>
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

      <div className="mt-3 flex items-center justify-start gap-6 cursor-default" onClick={(e) => {e.stopPropagation();}}>
        <ReactionBar
          postId={post.id}
          counts={post.reaction_counts || { thumbsup: 0, heart: 0, thumbsdown: 0 }}
          userReaction={post.user_reaction || null}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCommentsOpen((prev) => !prev);
          }}
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          <ChatCircle size={16} weight={commentsOpen ? "fill" : "regular"} />
          {post.comment_count ? `${post.comment_count}` : ""}
        </button>
      </div>

      <AnimatePresence>
        {commentsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3">
              <CommentSection
                postId={post.id}
                postAuthorId={post.author_id}
                currentUserId={currentUserId}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
