"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { GoogleLogo } from "@phosphor-icons/react";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function checkUsername(slug: string) {
    setUsernameError("");
    if (slug.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", slug)
      .single();
    if (existing) {
      setUsernameError("That username is taken");
      return false;
    }
    return true;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const slug = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const available = await checkUsername(slug);
    if (!available) {
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, username: slug },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("users")
          .update({ username: slug })
          .eq("id", user.id);
      }
      router.push("/welcome");
      router.refresh();
    }
  }

  async function handleOAuth(provider: "google" | "apple") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl font-bold text-text-primary">Create your account</h1>
        <p className="text-sm text-text-secondary">Start documenting your journey</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <Input
          label="Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="What should we call you?"
          required
        />
        <div>
          <Input
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="cooldev"
            error={usernameError}
            required
          />
          <p className="mt-1 text-xs text-text-secondary">
            defect.tech/<strong>{username || "..."}</strong>
          </p>
        </div>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          minLength={6}
          required
        />

        {error && <p className="text-sm text-error">{error}</p>}

        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>

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
        Already have an account?{" "}
        <Link href="/login" className="text-secondary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
