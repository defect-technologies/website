"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { EnvelopeSimple, GoogleLogo } from "@phosphor-icons/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
    } else {
      setMagicSent(true);
    }
    setLoading(false);
  }

  async function handleOAuth(provider: "google" | "apple") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  if (magicSent) {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <EnvelopeSimple size={48} className="text-accent" />
        </div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary">Check your email</h1>
        <p className="text-sm text-text-secondary">
          We sent a sign-in link to <strong>{email}</strong>. Click it to log in.
        </p>
        <button onClick={() => setMagicSent(false)} className="text-sm text-secondary hover:underline cursor-pointer">
          Try a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl font-bold text-text-primary">Welcome back</h1>
        <p className="text-sm text-text-secondary">Sign in to your Defect account</p>
      </div>

      <form onSubmit={mode === "password" ? handlePasswordLogin : handleMagicLink} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        {mode === "password" && (
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          {mode === "password" ? "Sign in" : "Send magic link"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "password" ? "magic" : "password")}
        className="w-full text-center text-sm text-secondary hover:underline cursor-pointer"
      >
        {mode === "password" ? "Sign in with magic link instead" : "Sign in with password instead"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-text-secondary">or continue with</span>
        </div>
      </div>

      <Button variant="secondary" className="w-full" onClick={() => handleOAuth("google")}>
        <GoogleLogo size={18} weight="bold" />
        Google
      </Button>

      <p className="text-center text-sm text-text-secondary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-secondary font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
