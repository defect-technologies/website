import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { DESIGNER_HOME } from "@/lib/designerWork";
import type { Designer } from "../db/schema";
import { activeDesignerByEmail } from "../designers/people";
import { clearSessionCookie, readSessionCookie, writeSessionCookie, type CookieSession } from "./signedCookie";

/** Its own cookie, so a designer's session is never a founder's: requireFounder reads only defect_admin. */
export const DESIGNER_COOKIE = "defect_designer";
const DESIGNER_SESSION: CookieSession = { cookie: DESIGNER_COOKIE, days: 30 };

export { DESIGNER_HOME };
export const SIGN_IN_PATH = "/admin/sign-in";

export async function startDesignerSession(designer: Designer) {
  await writeSessionCookie(DESIGNER_SESSION, designer.email);
}

export async function endDesignerSession() {
  await clearSessionCookie(DESIGNER_SESSION);
}

/** Deactivating a designer signs them out on their next request. */
async function readDesignerSession(): Promise<Designer | null> {
  const payload = await readSessionCookie(DESIGNER_SESSION);
  return payload?.sub ? activeDesignerByEmail(payload.sub) : null;
}

export const currentDesigner = cache(readDesignerSession);

/** The gate for every designer page and server action. */
export async function requireDesigner(): Promise<Designer> {
  const designer = await currentDesigner();
  if (!designer) redirect(SIGN_IN_PATH);
  return designer;
}
