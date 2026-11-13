import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "../env";

/** A keyed hash of the first address in x-forwarded-for, so callers can be counted without storing an address. */
export function callerKeyFrom(forwardedFor: string | null): string | undefined {
  const address = forwardedFor?.split(",")[0]?.trim();
  if (!address) return undefined;
  return createHmac("sha256", env.authSecret()).update(`portal-caller:${address}`).digest("hex");
}

export async function currentCallerKey(): Promise<string | undefined> {
  return callerKeyFrom((await headers()).get("x-forwarded-for"));
}
