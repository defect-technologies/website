import "server-only";
import { env, isDevelopment } from "../env";

export type SignInEmail = { to: string; url: string; expiresInMinutes: number };

/** The one way the editor sends email. Swap the implementation; nothing else changes. */
export interface SignInLinkSender {
  readonly ready: boolean;
  send(email: SignInEmail): Promise<void>;
}

/** Prints the link in the terminal running `next dev`. Nothing leaves the laptop. */
const consoleSender: SignInLinkSender = {
  ready: true,
  async send({ to, url, expiresInMinutes }) {
    console.info(`\n[editor] Sign-in link for ${to} (works once, for ${expiresInMinutes} minutes):\n${url}\n`);
  },
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function signInEmailText(url: string, expiresInMinutes: number): string {
  return [
    "Hi,",
    "",
    `Here's your link to edit your website. It works once, for the next ${expiresInMinutes} minutes:`,
    url,
    "",
    "If you didn't ask for this, you can ignore this email and nothing will change.",
    "",
    "Warmly,",
    "The Defect Technologies team",
    "hello@defect.tech",
  ].join("\n");
}

/**
 * Sends through Resend (free plan: 3,000 emails a month, 100 a day). Needs
 * SIGN_IN_EMAIL_API_KEY, a sending-only key, and SIGN_IN_EMAIL_FROM, such as
 * "Defect Technologies <sign-in@send.defect.tech>". Until both are set,
 * production shows "email sign-in isn't set up yet" instead of pretending to send.
 */
const resendSender: SignInLinkSender = {
  get ready() {
    const { apiKey, from } = env.signInEmail();
    return Boolean(apiKey && from);
  },
  async send({ to, url, expiresInMinutes }) {
    const { apiKey, from } = env.signInEmail();
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: "hello@defect.tech",
        subject: "Your link to edit your website",
        text: signInEmailText(url, expiresInMinutes),
      }),
    });
    if (!response.ok) throw new Error(`Resend refused the sign-in email (${response.status}): ${await response.text()}`);
  },
};

export function signInLinkSender(): SignInLinkSender {
  return isDevelopment ? consoleSender : resendSender;
}
