import { NextResponse, type NextRequest } from "next/server";
import { record } from "@/server/activity";
import { completeAuthorization, googleClient } from "@/server/auth/google";
import { requireFounder } from "@/server/auth/session";
import { db } from "@/server/db/client";
import { mailboxes } from "@/server/db/schema";
import { env } from "@/server/env";
import { seal } from "@/server/seal";

function back(result: string) {
  return NextResponse.redirect(new URL(`/admin/projects?mailbox=${result}`, env.siteUrl()));
}

export async function GET(request: NextRequest) {
  const founder = await requireFounder();
  const google = googleClient("mail");
  if (!google) return back("not-configured");
  const identity = await completeAuthorization(google, request.nextUrl.searchParams).catch(() => null);
  if (!identity) return back("failed");
  if (!identity.tokens.hasRefreshToken()) return back("no-refresh-token");
  const sealed = seal(identity.tokens.refreshToken());
  const database = await db();
  const isFirst = (await database.select({ id: mailboxes.id }).from(mailboxes).limit(1)).length === 0;
  await database
    .insert(mailboxes)
    .values({ email: identity.email, displayName: identity.name, sealedRefreshToken: sealed, connectedBy: founder.email, isSender: isFirst })
    .onConflictDoUpdate({
      target: mailboxes.email,
      set: { sealedRefreshToken: sealed, displayName: identity.name, connectedBy: founder.email, connectedAt: new Date(), lastError: "" },
    });
  await record(founder.email, "connected inbox", { detail: identity.email });
  return back("connected");
}
