import { eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { env } from "@/server/env";
import { advanceStage } from "@/server/leads/businesses";

/**
 * The link in every outreach email. It counts the click, then sends the owner
 * on to their preview. Clicks before the email went out (a founder testing it)
 * don't count. Some mail filters open links on arrival, so a click shortly
 * after sending can be a scanner rather than the owner.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const database = await db();
  const [business] = await database.select().from(businesses).where(eq(businesses.linkCode, code));
  if (!business?.previewUrl) return NextResponse.redirect(new URL("/", env.siteUrl()));
  if (business.firstSentAt) {
    await database
      .update(businesses)
      .set({ clickCount: sql`${businesses.clickCount} + 1`, clickedAt: business.clickedAt ?? new Date() })
      .where(eq(businesses.id, business.id));
    await advanceStage(business.id, "clicked");
  }
  const response = NextResponse.redirect(business.previewUrl);
  response.headers.set("X-Robots-Tag", "noindex");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
