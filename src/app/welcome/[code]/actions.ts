"use server";

import { env } from "@/server/env";
import { startWelcomeCheckout } from "@/server/integrations/stripe";
import { businessByLinkCode } from "@/server/leads/businesses";

/** Starts the owner's checkout and hands Stripe's form its client secret. */
export async function startCheckoutAction(code: string): Promise<string> {
  const business = await businessByLinkCode(code);
  if (!business?.previewUrl || business.paidAt) throw new Error("This welcome link can't start a checkout.");
  // Stripe fills in {CHECKOUT_SESSION_ID} itself, so it has to reach Stripe unencoded.
  const returnUrl = `${new URL(`/welcome/${code}/done`, env.siteUrl())}?session_id={CHECKOUT_SESSION_ID}`;
  try {
    return await startWelcomeCheckout(business, returnUrl);
  } catch (error) {
    console.error("[welcome] Checkout didn't start", business.slug, error);
    throw error;
  }
}
