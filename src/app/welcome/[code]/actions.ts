"use server";

import { z } from "zod";
import { env } from "@/server/env";
import { startWelcomeCheckout } from "@/server/integrations/stripe";
import { businessByLinkCode } from "@/server/leads/businesses";

const AccountEmail = z.email().max(254);

/** Starts the owner's checkout for the account email they chose and hands Stripe's form its client secret. */
export async function startCheckoutAction(code: string, accountEmail: string): Promise<string> {
  const email = AccountEmail.parse(accountEmail.trim().toLowerCase());
  const business = await businessByLinkCode(code);
  if (!business?.previewUrl || business.paidAt) throw new Error("This welcome link can't start a checkout.");
  // Stripe fills in {CHECKOUT_SESSION_ID} itself, so it has to reach Stripe unencoded.
  const returnUrl = `${new URL(`/welcome/${code}/done`, env.siteUrl())}?session_id={CHECKOUT_SESSION_ID}`;
  try {
    return await startWelcomeCheckout(business, returnUrl, email);
  } catch (error) {
    console.error("[welcome] Checkout didn't start", business.slug, error);
    throw error;
  }
}
