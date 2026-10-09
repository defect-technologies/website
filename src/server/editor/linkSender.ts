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

/**
 * TODO(email-service): send through a transactional email provider once the
 * founders pick one. Needs SIGN_IN_EMAIL_API_KEY and SIGN_IN_EMAIL_FROM
 * (for example "Defect Technologies <sign-in@defect.tech>", on a domain with
 * SPF and DKIM set up for that provider). Until then production shows
 * "email sign-in isn't set up yet" instead of pretending to send.
 */
const productionSender: SignInLinkSender = {
  get ready() {
    const { apiKey, from } = env.signInEmail();
    return Boolean(apiKey && from);
  },
  async send() {
    throw new Error("Sign-in email isn't implemented yet. See TODO(email-service) in src/server/editor/linkSender.ts.");
  },
};

export function signInLinkSender(): SignInLinkSender {
  return isDevelopment ? consoleSender : productionSender;
}
