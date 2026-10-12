"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useMemo, useRef, useState } from "react";
import { startCheckoutAction } from "@/app/welcome/[code]/actions";
import { useSeenOnce } from "@/hooks/useSeenOnce";
import { Notice } from "../admin/ui";

/**
 * Stripe's checkout form, inside the page. It starts a checkout only once the owner scrolls to it,
 * so a visit that never gets this far doesn't open one.
 */
export default function PlanCheckout({ code, publishableKey }: { code: string; publishableKey: string }) {
  const area = useRef<HTMLDivElement>(null);
  const reached = useSeenOnce(area, true, 0.01);
  const stripe = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const [failed, setFailed] = useState(false);
  const fetchClientSecret = useCallback(
    () =>
      startCheckoutAction(code).catch((error: unknown) => {
        setFailed(true);
        throw error;
      }),
    [code],
  );

  if (failed) {
    return (
      <Notice tone="bad">
        Unable to load the checkout. Refresh the page to try again, or email{" "}
        <a href="mailto:hello@defect.tech" className="underline underline-offset-4">
          hello@defect.tech
        </a>{" "}
        and we&apos;ll sign you up.
      </Notice>
    );
  }

  return (
    <div ref={area} className="bg-surface shadow-card min-h-[38rem] overflow-hidden rounded-2xl">
      {reached && (
        <EmbeddedCheckoutProvider stripe={stripe} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      )}
    </div>
  );
}
