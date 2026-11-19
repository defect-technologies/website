/** What a Stripe subscription says about cancelling. Times are Stripe's seconds. */
export type SubscriptionCancelState = { status: string; cancel_at_period_end: boolean; cancel_at: number | null; canceled_at: number | null };

/**
 * When the client cancelled, or null while their plan runs. A plan set to end at the period's end is cancelled from the
 * moment they asked, and a plan they resumed before it ended is running again.
 */
export function cancelledAt(subscription: SubscriptionCancelState, now = new Date()): Date | null {
  const cancelling = subscription.status === "canceled" || subscription.cancel_at_period_end || Boolean(subscription.cancel_at);
  if (!cancelling) return null;
  return subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : now;
}
