import { NextResponse } from "next/server";
import { requireFounder } from "@/server/auth/session";
import { loadSamples } from "@/server/dev/sample";
import { devShortcutsEnabled, env } from "@/server/env";

/** Loads made-up leads into the local database. Only exists with ADMIN_DEV_SIGN_IN=1 under `next dev`. */
export async function POST() {
  if (!devShortcutsEnabled) return new NextResponse(null, { status: 404 });
  await requireFounder();
  await loadSamples();
  return NextResponse.redirect(new URL("/admin/pipeline", env.siteUrl()), 303);
}
