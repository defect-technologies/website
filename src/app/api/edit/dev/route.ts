import { NextResponse } from "next/server";
import { startOwnerSession } from "@/server/auth/ownerSession";
import { ensureSampleSite, SAMPLE_OWNER_EMAIL } from "@/server/dev/sampleSite";
import { devShortcutsEnabled, env } from "@/server/env";

/** Signs in as the sample florist's owner, adding the sample site first. Only exists with ADMIN_DEV_SIGN_IN=1 under `next dev`. */
export async function GET() {
  if (!devShortcutsEnabled) return new NextResponse(null, { status: 404 });
  await ensureSampleSite();
  await startOwnerSession(SAMPLE_OWNER_EMAIL);
  return NextResponse.redirect(new URL("/edit", env.siteUrl()));
}
