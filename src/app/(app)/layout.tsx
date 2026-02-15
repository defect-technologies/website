import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("circle_memberships")
    .select("circle_id, role, circles(*)")
    .eq("user_id", user.id);

  const circles = memberships?.map((m) => (m as unknown as { circles: Record<string, unknown> }).circles).filter(Boolean) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto flex">
        <Sidebar
          user={profile}
          circles={circles as never[]}
        />
        <main className="flex-1 min-h-screen border-x border-border/50 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
