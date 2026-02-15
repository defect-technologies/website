"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { CheckCircle, UsersThree } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "circle" | "done";

export default function WelcomePage() {
  const [step, setStep] = useState<Step>("circle");
  const [circleName, setCircleName] = useState("");
  const [circleDescription, setCircleDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleCreateCircle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: circle } = await supabase
      .from("circles")
      .insert({ name: circleName, description: circleDescription || null, created_by: user.id })
      .select()
      .single();

    if (circle) {
      await supabase
        .from("circle_memberships")
        .insert({ circle_id: circle.id, user_id: user.id, role: "admin" });
    }

    setStep("done");
    setLoading(false);
  }

  function handleSkipCircle() {
    setStep("done");
  }

  function handleFinish() {
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2 mb-8">
        {(["circle", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s
                  ? "bg-accent text-white"
                  : (["circle", "done"].indexOf(step) > i)
                  ? "bg-success text-white"
                  : "bg-border/40 text-text-secondary"
              }`}
            >
              {(["circle", "done"].indexOf(step) > i) ? (
                <CheckCircle size={18} weight="bold" />
              ) : (
                i + 1
              )}
            </div>
            {i < 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === "circle" && (
          <motion.div
            key="circle"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <UsersThree size={48} className="mx-auto text-secondary" />
              <h1 className="font-serif text-2xl font-bold text-text-primary">Create your first circle</h1>
              <p className="text-sm text-text-secondary">
                Circles are groups where you share updates and compete with friends
              </p>
            </div>
            <form onSubmit={handleCreateCircle} className="space-y-4">
              <Input
                label="Circle name"
                value={circleName}
                onChange={(e) => setCircleName(e.target.value)}
                placeholder="e.g. Study Group, Side Project Squad"
                required
              />
              <Input
                label="Description (optional)"
                value={circleDescription}
                onChange={(e) => setCircleDescription(e.target.value)}
                placeholder="What's this circle about?"
              />
              <Button type="submit" loading={loading} className="w-full">
                Create circle
              </Button>
            </form>
            <button
              onClick={handleSkipCircle}
              className="w-full text-center text-sm text-text-secondary hover:text-secondary cursor-pointer"
            >
              Skip for now
            </button>
          </motion.div>
        )}

        {step === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <CheckCircle size={64} weight="fill" className="mx-auto text-success" />
            <h1 className="font-serif text-2xl font-bold text-text-primary">You&apos;re all set!</h1>
            <p className="text-sm text-text-secondary">
              Time to start documenting your journey. Post your first update!
            </p>
            <Button onClick={handleFinish} className="w-full">
              Go to your feed
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
