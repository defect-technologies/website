import "server-only";
import { env, isDevelopment } from "../env";

export type SignInEmail = { to: string; siteAddress: string; url: string; expiresInMinutes: number };

/** The one way the editor sends email. Swap the implementation; nothing else changes. */
export interface SignInLinkSender {
  readonly ready: boolean;
  send(email: SignInEmail): Promise<void>;
}

/** Prints the link in the terminal running `next dev`. Nothing leaves the laptop. */
const consoleSender: SignInLinkSender = {
  ready: true,
  async send({ to, siteAddress, url, expiresInMinutes }) {
    console.info(`\n[editor] Sign-in link for ${to} to edit ${siteAddress} (works for ${expiresInMinutes} minutes):\n${url}\n`);
  },
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

function signInEmailText({ siteAddress, url, expiresInMinutes }: SignInEmail): string {
  return [
    "Hi,",
    "",
    `Here's your link to edit ${siteAddress}. It works once, within the next ${expiresInMinutes} minutes:`,
    url,
    "",
    "If it expires, ask for a new one at https://defect.tech/edit/sign-in.",
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
 * "Defect Technologies <sign-in@send.defect.tech>". Until both are set, and
 * EDITOR_SECRET too, /edit/sign-in says email sign-in isn't switched on yet.
 */
const resendSender: SignInLinkSender = {
  get ready() {
    const { apiKey, from } = env.signInEmail();
    return Boolean(apiKey && from);
  },
  async send(email) {
    const { apiKey, from } = env.signInEmail();
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email.to],
        reply_to: "hello@defect.tech",
        subject: `Your link to edit ${email.siteAddress}`,
        text: signInEmailText(email),
      }),
    });
    if (!response.ok) throw new Error(`Resend refused the sign-in email (${response.status}): ${await response.text()}`);
  },
};

export function signInLinkSender(): SignInLinkSender {
  return isDevelopment ? consoleSender : resendSender;
}
