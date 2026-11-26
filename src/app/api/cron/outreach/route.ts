import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { sendNextApprovedEmail } from "@/server/outreach/autoSend";

/** Vercel Cron calls this every few minutes with `Authorization: Bearer $CRON_SECRET`. It sends one due email at most. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendNextApprovedEmail());
}
