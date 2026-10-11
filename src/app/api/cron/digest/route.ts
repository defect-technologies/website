import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { openFlags, openFyis } from "@/server/bots/flags";
import { env } from "@/server/env";
import { sendDigest } from "@/server/flags/notify";

/** Vercel Cron calls this at 7 PM Pacific (02:00 UTC; 6 PM in winter) with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [open, fyis] = await Promise.all([openFlags(), openFyis()]);
  return NextResponse.json(await sendDigest(open, fyis));
}
