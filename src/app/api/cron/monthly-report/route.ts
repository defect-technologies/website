import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { sendMonthlyReports } from "@/server/reports/monthlyReport";

/** Vercel Cron calls this on the 1st of each month at 9 AM Pacific (16:00 UTC) with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await sendMonthlyReports());
}
