import "server-only";

function optional(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function required(name: string): string {
  const value = optional(name);
  if (!value) throw new Error(`${name} is not set. See .env.example.`);
  return value;
}

export const isDevelopment = process.env.NODE_ENV === "development";

/** A shortcut past Google sign-in, Gmail, and the editor's email links, for running locally. Never on in a production build. */
export const devShortcutsEnabled = isDevelopment && optional("ADMIN_DEV_SIGN_IN") === "1";

export const env = {
  databaseUrl: () => optional("DATABASE_URL"),
  authSecret: () => required("AUTH_SECRET"),
  siteUrl: () => optional("SITE_URL") || "http://localhost:3217",
  founderEmails: () =>
    optional("ADMIN_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  signInClient: () => ({ id: optional("GOOGLE_SIGNIN_CLIENT_ID"), secret: optional("GOOGLE_SIGNIN_CLIENT_SECRET") }),
  mailClient: () => ({ id: optional("GOOGLE_MAIL_CLIENT_ID"), secret: optional("GOOGLE_MAIL_CLIENT_SECRET") }),
  engineToken: () => optional("ENGINE_TOKEN"),
  cronSecret: () => optional("CRON_SECRET"),
  stripeKey: () => optional("STRIPE_API_KEY"),
  vercel: () => ({
    token: optional("VERCEL_TOKEN"),
    teamId: optional("VERCEL_TEAM_ID"),
    previewProject: optional("VERCEL_PREVIEW_PROJECT"),
  }),
  healthchecksKey: () => optional("HEALTHCHECKS_API_KEY"),
  signInEmail: () => ({ apiKey: optional("SIGN_IN_EMAIL_API_KEY"), from: optional("SIGN_IN_EMAIL_FROM") }),
};
