"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Avatar from "@/components/ui/Avatar";
import { Check, X } from "@phosphor-icons/react";
import type { User } from "@/types";

interface FollowRequest {
  follower_id: string;
  created_at: string;
  follower: User;
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (profile) {
        setUser(profile);
        setDisplayName(profile.display_name);
        setBio(profile.bio || "");
      }

      const { data: pendingFollows } = await supabase
        .from("follows")
        .select("follower_id, created_at, follower:users!follows_follower_id_fkey(*)")
        .eq("following_id", authUser.id)
        .eq("status", "pending");

      if (pendingFollows) {
        setFollowRequests(
          pendingFollows.map((f) => ({
            follower_id: f.follower_id,
            created_at: f.created_at,
            follower: (f as unknown as { follower: User }).follower,
          }))
        );
      }
    }
    loadProfile();
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    await supabase
      .from("users")
      .update({ display_name: displayName, bio: bio || null })
      .eq("id", user.id);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setLoading(false);
    router.refresh();
  }

  async function handleFollowResponse(followerId: string, action: "accept" | "reject") {
    setRespondingId(followerId);
    const res = await fetch("/api/follows/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ follower_id: followerId, action }),
    });
    if (res.ok) {
      setFollowRequests((prev) => prev.filter((r) => r.follower_id !== followerId));
    }
    setRespondingId(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your profile and account</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar src={user.avatar_url} name={user.display_name} size="lg" />
          <div>
            <p className="text-sm font-medium text-text-primary">@{user.username}</p>
            <p className="text-xs text-text-secondary">Profile photo can be changed via your auth provider</p>
          </div>
        </div>

        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />

        <Textarea
          label="Bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell others about yourself..."
          maxChars={160}
          charCount={bio.length}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" loading={loading}>
            Save changes
          </Button>
          {saved && <span className="text-sm text-success">Saved!</span>}
        </div>
      </form>

      {followRequests.length > 0 && (
        <div className="pt-6 border-t border-border">
          <h2 className="font-serif text-lg font-semibold text-text-primary mb-4">
            Follow requests
            <span className="ml-2 text-sm font-normal text-text-secondary">{followRequests.length}</span>
          </h2>
          <div className="space-y-2">
            {followRequests.map((req) => (
              <div key={req.follower_id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
                <Avatar src={req.follower.avatar_url} name={req.follower.display_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{req.follower.display_name}</p>
                  <p className="text-xs text-text-secondary truncate">@{req.follower.username}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => handleFollowResponse(req.follower_id, "accept")}
                    loading={respondingId === req.follower_id}
                  >
                    <Check size={14} weight="bold" />
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFollowResponse(req.follower_id, "reject")}
                    disabled={respondingId === req.follower_id}
                  >
                    <X size={14} />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-border">
        <h2 className="font-serif text-lg font-semibold text-text-primary mb-4">Account</h2>
        <Button variant="danger" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
