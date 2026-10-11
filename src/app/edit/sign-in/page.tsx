import { redirect } from "next/navigation";

/** Owners sign in through their portal now; older links and bookmarks land here. */
export default async function EditorSignInPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams;
  redirect(site ? `/portal/sign-in?site=${encodeURIComponent(site)}` : "/portal/sign-in");
}
