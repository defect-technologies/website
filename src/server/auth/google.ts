import "server-only";
import { decodeIdToken, generateCodeVerifier, generateState, Google, type OAuth2Tokens } from "arctic";
import { cookies } from "next/headers";
import { env } from "../env";

/**
 * Two Google clients. Founders sign in with basic scopes. The mail client asks
 * for Gmail send and read, and should live in a project owned by the sending
 * inbox's Workspace with its consent screen set to Internal, so its refresh
 * tokens don't expire after a week.
 */
export type GoogleFlow = "sign-in" | "mail";

const FLOWS: Record<GoogleFlow, { path: string; scopes: string[]; client: () => { id: string; secret: string } }> = {
  "sign-in": {
    path: "/api/auth/google/callback",
    scopes: ["openid", "email", "profile"],
    client: env.signInClient,
  },
  mail: {
    path: "/api/mailboxes/callback",
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    client: env.mailClient,
  },
};

const STATE_COOKIE = "defect_oauth_state";
const VERIFIER_COOKIE = "defect_oauth_verifier";

export function googleClient(flow: GoogleFlow): Google | null {
  const { id, secret } = FLOWS[flow].client();
  if (!id || !secret) return null;
  return new Google(id, secret, new URL(FLOWS[flow].path, env.siteUrl()).toString());
}

export async function authorizationUrl(flow: GoogleFlow, google: Google, loginHint = "") {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = google.createAuthorizationURL(state, verifier, FLOWS[flow].scopes);
  if (flow === "mail") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  const jar = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set(STATE_COOKIE, state, options);
  jar.set(VERIFIER_COOKIE, verifier, options);
  return url;
}

export type GoogleIdentity = { email: string; name: string; tokens: OAuth2Tokens };

/** The code and verifier for this callback, or null when the state doesn't match the one we set. */
async function takeVerifiedCode(searchParams: URLSearchParams) {
  const jar = await cookies();
  const expectedState = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(VERIFIER_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  jar.delete(VERIFIER_COOKIE);
  const code = searchParams.get("code");
  const stateMatches = Boolean(expectedState) && searchParams.get("state") === expectedState;
  return code && verifier && stateMatches ? { code, verifier } : null;
}

type IdClaims = { email?: string; email_verified?: boolean; name?: string };

/** Checks the state, trades the code for tokens, and reads who signed in. Null on any mismatch. */
export async function completeAuthorization(google: Google, searchParams: URLSearchParams): Promise<GoogleIdentity | null> {
  const grant = await takeVerifiedCode(searchParams);
  if (!grant) return null;
  const tokens = await google.validateAuthorizationCode(grant.code, grant.verifier);
  // The ID token came straight from Google's token endpoint over TLS, so its claims can be read without re-verifying.
  const claims = decodeIdToken(tokens.idToken()) as IdClaims;
  if (!claims.email || !claims.email_verified) return null;
  return { email: claims.email.toLowerCase(), name: claims.name ?? claims.email, tokens };
}
