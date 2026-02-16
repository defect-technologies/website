"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Select, { type SelectOption } from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { PaperPlaneTilt, Globe, Lock, Users, UsersThree, Paperclip, FileText, X } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import type { Circle, Group, User } from "@/types";

type Visibility = "personal" | "group" | "circle" | "public";

interface ComposerProps {
  circles: Circle[];
  groups?: Group[];
  defaultCircleId?: string;
}

type PreviewItem = {
  url: string;
  kind: "image" | "video";
  name: string;
};

const visibilityOptions: SelectOption[] = [
  {
    value: "public",
    label: "Public",
    icon: Globe,
    color: "var(--accent)",
    description: "Everyone",
  },
  {
    value: "circle",
    label: "Circle",
    icon: Users,
    color: "var(--secondary)",
    description: "Everyone in the selected circle",
  },
  {
    value: "group",
    label: "Group",
    icon: UsersThree,
    color: "var(--success)",
    description: "Everyone in the selected group",
  },
  {
    value: "personal",
    label: "Personal",
    icon: Lock,
    color: "var(--text-secondary)",
    description: "Only you",
  },
];

export default function Composer({ circles, groups = [], defaultCircleId }: ComposerProps) {
  const [content, setContent] = useState("");
  const [circleId, setCircleId] = useState(defaultCircleId || circles[0]?.id || "");
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [visibility, setVisibility] = useState<Visibility>(defaultCircleId ? "circle" : "public");
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Array<PreviewItem | null>>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<User[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionSearchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const router = useRouter();
  const supabase = createClient();
  const maxAttachments = 4;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (content) localStorage.setItem("devlog_draft", content);
    }, 500);
    return () => clearTimeout(timeout);
  }, [content]);

  useEffect(() => {
    const draft = localStorage.getItem("devlog_draft");
    if (draft) setContent(draft);
  }, []);

  useEffect(() => {
    const nextPreviews = selectedFiles.map((file) => {
      if (file.type.startsWith("image/")) {
        return { url: URL.createObjectURL(file), kind: "image", name: file.name };
      }
      if (file.type.startsWith("video/")) {
        return { url: URL.createObjectURL(file), kind: "video", name: file.name };
      }
      return null;
    });

    setPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => {
        if (preview) URL.revokeObjectURL(preview.url);
      });
    };
  }, [selectedFiles]);

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...files].slice(0, maxAttachments));
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = "";
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files || []);
    if (files.length === 0) return;
    e.preventDefault();
    addFiles(files);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function checkForMention(textarea: HTMLTextAreaElement) {
    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const match = textBefore.match(/@(\w*)$/);

    if (match) {
      const query = match[1];
      setMentionQuery(query);
      setMentionIndex(0);

      if (query.length >= 1) {
        clearTimeout(mentionSearchTimer.current);
        mentionSearchTimer.current = setTimeout(async () => {
          const { data } = await supabase
            .from("users")
            .select("*")
            .ilike("username", `${query}%`)
            .limit(5);
          setMentionResults((data || []) as User[]);
        }, 150);
      } else {
        setMentionResults([]);
      }
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }

  function insertMention(user: User) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf("@");
    const newContent = textBefore.slice(0, atIndex) + `@${user.username} ` + textAfter;

    setContent(newContent);
    setMentionQuery(null);
    setMentionResults([]);

    requestAnimationFrame(() => {
      const newPos = atIndex + user.username.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    });
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (mentionResults[mentionIndex]) {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
      }
    } else if (e.key === "Escape") {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const postData: Record<string, unknown> = {
      author_id: user.id,
      content: content.trim(),
      circle_id: visibility === "circle" ? circleId || null : null,
      group_id: visibility === "group" ? groupId || null : null,
      visibility,
    };

    const { data: post, error } = await supabase.from("posts").insert(postData).select().single();

    if (!error && post) {
      if (selectedFiles.length > 0) {
        const total = selectedFiles.length;
        for (let i = 0; i < total; i++) {
          const file = selectedFiles[i];
          const mediaType = file.type.startsWith("image/")
            ? "image"
            : file.type.startsWith("video/")
              ? "video"
              : "file";
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${user.id}/${post.id}/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(path, file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(path);
            await supabase.from("media").insert({
              post_id: post.id,
              type: mediaType,
              url: urlData.publicUrl,
              width: null,
              height: null,
            });
          }

          setUploadProgress(Math.round(((i + 1) / total) * 100));
        }
      }

      localStorage.removeItem("devlog_draft");
      setContent("");
      setSelectedFiles([]);
      setUploadProgress(0);

      fetch("/api/score/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });

      const mentionMatches = content.match(/@(\w+)/g);
      if (mentionMatches) {
        const usernames = [...new Set(mentionMatches.map((m) => m.slice(1)))];
        const { data: mentionedUsers } = await supabase
          .from("users")
          .select("id, username")
          .in("username", usernames)
          .neq("id", user.id);

        if (mentionedUsers && mentionedUsers.length > 0) {
          const { data: profile } = await supabase
            .from("users")
            .select("display_name")
            .eq("id", user.id)
            .single();

          await supabase.from("notifications").insert(
            mentionedUsers.map((mu) => ({
              user_id: mu.id,
              type: "mention" as const,
              title: `${profile?.display_name || "Someone"} mentioned you`,
              body: `${content.slice(0, 100)}${content.length > 100 ? "..." : ""}`,
              link: post.circle_id ? `/c/${post.circle_id}` : null,
            }))
          );
        }
      }

      router.refresh();
    }

    setLoading(false);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            checkForMention(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && mentionResults.length === 0) {
              e.preventDefault();
              formRef.current?.requestSubmit();
              return;
            }
            handleTextareaKeyDown(e);
          }}
          onPaste={handlePaste}
          placeholder="What are you working on?"
          maxChars={2500}
          charCount={content.length}
          className="border-0 px-0 focus:ring-0"
        />
        {mentionQuery !== null && mentionResults.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {mentionResults.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors ${
                  i === mentionIndex ? "bg-background" : "hover:bg-background/50"
                }`}
              >
                <Avatar src={u.avatar_url} name={u.display_name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.display_name}</p>
                  <p className="text-xs text-text-secondary">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {selectedFiles.map((file, i) => {
            const preview = previews[i];
            return (
              <div key={`${file.name}-${i}`} className="relative group">
                {preview ? (
                  preview.kind === "image" ? (
                    <img src={preview.url} alt={preview.name} className="h-20 w-20 rounded-md object-cover" />
                  ) : (
                    <video
                      src={preview.url}
                      className="h-20 w-20 rounded-md object-cover"
                      muted
                      playsInline
                    />
                  )
                ) : (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-text-secondary max-w-[160px]">
                    <FileText size={16} />
                    <span className="truncate">{file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute -top-1.5 -right-1.5 bg-error text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {loading && uploadProgress > 0 && uploadProgress < 100 && (
        <div className="h-1 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFilesSelected}
        className="hidden"
      />

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2">
          <Select
            value={visibility}
            onChange={(nextValue) => setVisibility(nextValue as Visibility)}
            options={visibilityOptions}
            size="sm"
            disabled={!!defaultCircleId}
          />
          {visibility === "group" && groups.length > 0 && (
            // <select
            //   value={groupId}
            //   onChange={(e) => setGroupId(e.target.value)}
            //   className="text-xs rounded-md border border-border bg-background px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-secondary/30"
            // >
            //   {groups.map((g) => (
            //     <option key={g.id} value={g.id}>{g.name}</option>
            //   ))}
            // </select>
            <Select
              value={groupId}
              onChange={(nextValue) => setGroupId(nextValue)}
              options={groups.map((g) => ({
                value: g.id,
                label: g.name,
                color: g.color || undefined,
              }))}
              size="sm"
            />
          )}
          {visibility === "circle" && circles.length > 0 && (
            <Select
              value={circleId}
              onChange={(nextValue) => setCircleId(nextValue)}
              options={circles.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              disabled={!!defaultCircleId}
              size="sm"
            />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer p-1"
            title="Add attachments"
          >
            <Paperclip size={20} />
          </button>
        </div>

        <Button
          type="submit"
          size="sm"
          loading={loading}
          disabled={!content.trim() || content.length > 2500}
        >
          <PaperPlaneTilt size={16} weight="bold" />
          Post
        </Button>
      </div>
    </form>
  );
}
