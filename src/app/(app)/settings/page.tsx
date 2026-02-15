"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Avatar from "@/components/ui/Avatar";
import { Camera } from "@phosphor-icons/react";
import type { User } from "@/types";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    }
    loadProfile();
  }, [supabase]);

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await supabase
        .from("users")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      setUser({ ...user, avatar_url: avatarUrl });
      router.refresh();
    }

    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
          <div className="relative group">
            <Avatar src={user.avatar_url} name={user.display_name} size="lg" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors cursor-pointer"
            >
              <Camera
                size={20}
                weight="fill"
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">@{user.username}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="text-xs text-accent hover:underline cursor-pointer"
            >
              {uploadingAvatar ? "Uploading..." : "Change photo"}
            </button>
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

      <div className="pt-6 border-t border-border">
        <h2 className="font-serif text-lg font-semibold text-text-primary mb-4">Account</h2>
        <Button variant="danger" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
