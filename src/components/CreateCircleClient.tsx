"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

export default function CreateCircleClient() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: circle } = await supabase
      .from("circles")
      .insert({
        name,
        description: description || null,
        prize_description: prize || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (circle) {
      await supabase
        .from("circle_memberships")
        .insert({ circle_id: circle.id, user_id: user.id, role: "admin" });

      router.push(`/c/${circle.id}`);
      router.refresh();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Circle name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Indie Hackers, Study Buddies"
        required
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What's this circle about?"
        charCount={description.length}
        maxChars={500}
      />
      <Input
        label="Prize (optional)"
        value={prize}
        onChange={(e) => setPrize(e.target.value)}
        placeholder="e.g. Loser buys boba"
      />
      <Button type="submit" loading={loading} className="w-full">
        Create circle
      </Button>
    </form>
  );
}
