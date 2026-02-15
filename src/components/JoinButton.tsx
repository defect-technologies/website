"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";

export default function JoinButton({ circleId }: { circleId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleJoin() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("circle_memberships")
      .insert({ circle_id: circleId, user_id: user.id, role: "member" });

    router.refresh();
    setLoading(false);
  }

  return (
    <Button onClick={handleJoin} loading={loading} size="sm">
      Join circle
    </Button>
  );
}
