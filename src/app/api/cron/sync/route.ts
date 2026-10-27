import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { syncPayments } from "@/server/integrations/stripe";
import { syncMail } from "@/server/mail/sync";

/** Vercel Cron calls this at 5 and 35 past the hour, the moments everything that uses the database shares (so Neon can
 * sleep in between: the preview runner and flag worker ask then too), with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [mail, payments] = await Promise.all([syncMail(), syncPayments()]);
  return NextResponse.json({ mail, payments });
}
