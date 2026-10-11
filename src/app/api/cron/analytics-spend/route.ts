import { NextResponse } from "next/server";
import { checkAnalyticsSpend } from "@/server/alerts/analyticsSpend";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";

/** Vercel Cron calls this every morning with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await checkAnalyticsSpend());
}
