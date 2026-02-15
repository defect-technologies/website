"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { LinkSimple, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [joinedCircle, setJoinedCircle] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/circles/join-by-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409 && data.circle) {
        setJoinedCircle(data.circle);
      } else {
        setError(data.error || "Something went wrong");
      }
    } else {
      setJoinedCircle(data.circle);
      router.refresh();
    }

    setLoading(false);
  }

  if (joinedCircle) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 pt-12">
        <CheckCircle size={48} weight="fill" className="mx-auto text-success" />
        <h1 className="font-serif text-2xl font-bold text-text-primary">You&apos;re in!</h1>
        <p className="text-sm text-text-secondary">
          You&apos;ve joined <strong>{joinedCircle.name}</strong>
        </p>
        <Link href={`/c/${joinedCircle.id}`}>
          <Button className="w-full">Go to circle</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-12">
      <div className="text-center space-y-2">
        <LinkSimple size={48} className="mx-auto text-secondary" />
        <h1 className="font-serif text-2xl font-bold text-text-primary">Join a circle</h1>
        <p className="text-sm text-text-secondary">
          Enter an invite code to join someone&apos;s circle
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. a1b2c3d4e5f6"
          required
        />

        {error && (
          <div className="flex items-center gap-2 text-sm text-error">
            <WarningCircle size={16} />
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Join circle
        </Button>
      </form>
    </div>
  );
}
