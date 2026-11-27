import { NextResponse } from "next/server";
import { hasBearer } from "@/server/auth/bearer";
import { env } from "@/server/env";
import { syncPayments } from "@/server/integrations/stripe";
import { syncCancellations } from "@/server/integrations/stripeCancellations";
import { syncMail } from "@/server/mail/sync";
import { watchBots } from "@/server/bots/watch";

/** Vercel Cron calls this at 5 and 35 past the hour, the moments everything that uses the database shares (so Neon can
 * sleep in between: the preview runner and flag worker ask then too), with `Authorization: Bearer $CRON_SECRET`.
 * Each run also emails the founders about any bot that stopped checking in. */
export async function GET(request: Request) {
  if (!hasBearer(request, env.cronSecret())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [mail, payments] = await Promise.all([syncMail(), syncPayments()]);
  // After payments, so a client who paid and cancelled within one half hour has their subscription recorded first.
  const cancellations = await syncCancellations();
  const bots = await watchBots().catch((error: Error) => ({ error: error.message }));
  const failed = payments.state === "error" || cancellations.state === "error" || mail.errors.length > 0 || "error" in bots;
  return NextResponse.json({ mail, payments, cancellations, bots }, { status: failed ? 500 : 200 });
}
