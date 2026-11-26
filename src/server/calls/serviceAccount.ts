import "server-only";
import { env } from "../env";

type ServiceAccount = { client_email: string; private_key: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FREE_BUSY_SCOPE = "https://www.googleapis.com/auth/calendar.freebusy";

let cachedToken: { value: string; expiresAt: number } | null = null;

export function serviceAccount(): ServiceAccount | null {
  const json = env.serviceAccountJson();
  return json ? (JSON.parse(json) as ServiceAccount) : null;
}

const base64Url = (bytes: Uint8Array | Buffer | string) => Buffer.from(bytes).toString("base64url");

async function signedAssertion(account: ServiceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({ iss: account.client_email, scope: FREE_BUSY_SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 3600 }));
  const der = Buffer.from(account.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;
}

/** A short-lived token that can read free/busy and nothing else. */
export async function freeBusyToken(account: ServiceAccount) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await signedAssertion(account) }),
  });
  if (!response.ok) throw new Error(`Google refused the service account: ${response.status}`);
  const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}
