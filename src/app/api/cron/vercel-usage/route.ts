import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { recordVercelUsage } from "@/server/expenses/vercelUsage";

/** Vercel Cron calls this on the 9th of each month, the day after the billing cycle ends, with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await recordVercelUsage());
}
