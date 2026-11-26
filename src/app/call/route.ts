import { NextResponse } from "next/server";
import { outreachSettings } from "@/server/settings";

/**
 * The call link the bots send owners. It forwards to the booking page set in Setup > Outreach, so the bots' link
 * rule (only defect.tech and Stripe links) holds and the booking page can change without a new email.
 */
export async function GET() {
  const { callLink } = await outreachSettings();
  const response = NextResponse.redirect(callLink || "mailto:hello@defect.tech?subject=A%20call");
  response.headers.set("X-Robots-Tag", "noindex");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
