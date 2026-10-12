"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { startCheckoutAction } from "@/app/welcome/[code]/actions";
import { Button } from "../Button";
import { TextField } from "../admin/fields";
import { Card, Notice } from "../admin/ui";

function CheckoutFailed() {
  return (
    <Notice tone="bad">
      The checkout didn&apos;t load. Try refreshing the page. If that doesn&apos;t work, email{" "}
      <a href="mailto:hello@defect.tech" className="underline underline-offset-4">
        hello@defect.tech
      </a>
      . We&apos;ll sign you up by email instead.
    </Notice>
  );
}

/** The account email comes first: it's the portal sign-in and where we write, so it may differ from the address we emailed. */
function AccountEmailForm({ initial, onContinue }: { initial: string; onContinue: (email: string) => void }) {
  const [email, setEmail] = useState(initial);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) onContinue(email.trim());
  };
  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label="Email for your account"
          name="accountEmail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          hint="You'll sign in to your portal with this email. It's also where we'll write to you."
        />
        <div>
          <Button type="submit" variant="solid" icon={<ArrowRight size={18} weight="bold" aria-hidden="true" />}>
            Continue to payment
          </Button>
        </div>
      </form>
    </Card>
  );
}

function StripeCheckout({ code, email, publishableKey, onFail }: { code: string; email: string; publishableKey: string; onFail: () => void }) {
  const stripe = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const fetchClientSecret = useCallback(
    () =>
      startCheckoutAction(code, email).catch((error: unknown) => {
        onFail();
        throw error;
      }),
    [code, email, onFail],
  );
  return (
    <div className="bg-surface shadow-card min-h-[38rem] overflow-hidden rounded-2xl">
      <EmbeddedCheckoutProvider stripe={stripe} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

/** The account email, then Stripe's checkout form inside the page. A checkout only starts once they continue. */
export default function PlanCheckout({ code, publishableKey, suggestedEmail }: { code: string; publishableKey: string; suggestedEmail: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  if (failed) return <CheckoutFailed />;
  if (!email) return <AccountEmailForm initial={suggestedEmail} onContinue={setEmail} />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-soft flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Account email <span className="text-ink font-medium">{email}</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => setEmail(null)}>
          Change email
        </Button>
      </p>
      <StripeCheckout key={email} code={code} email={email} publishableKey={publishableKey} onFail={fail} />
    </div>
  );
}
