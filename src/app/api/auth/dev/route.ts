import { NextResponse } from "next/server";
import { startSession } from "@/server/auth/session";
import { devShortcutsEnabled, env } from "@/server/env";

/** Signs in as the first founder without Google. Only exists with ADMIN_DEV_SIGN_IN=1 under `next dev`. */
export async function GET() {
  const [email] = env.founderEmails();
  if (!devShortcutsEnabled || !email) return new NextResponse(null, { status: 404 });
  await startSession({ email, name: email.split("@")[0] });
  return NextResponse.redirect(new URL("/admin", env.siteUrl()));
}
