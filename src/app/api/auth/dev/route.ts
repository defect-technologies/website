import { NextResponse, type NextRequest } from "next/server";
import { DESIGNER_HOME, startDesignerSession } from "@/server/auth/designerSession";
import { startSession } from "@/server/auth/session";
import { firstActiveDesigner } from "@/server/designers/people";
import { devShortcutsEnabled, env } from "@/server/env";

/**
 * Signs in as the first founder without Google, or with ?as=designer as the first active designer. Only exists with
 * ADMIN_DEV_SIGN_IN=1 under `next dev`.
 */
export async function GET(request: NextRequest) {
  if (!devShortcutsEnabled) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.searchParams.get("as") === "designer") return signInDesigner();
  const [email] = env.founderEmails();
  if (!email) return new NextResponse(null, { status: 404 });
  await startSession({ email, name: email.split("@")[0] });
  return NextResponse.redirect(new URL("/admin", env.siteUrl()));
}

async function signInDesigner() {
  const designer = await firstActiveDesigner();
  if (!designer) return new NextResponse(null, { status: 404 });
  await startDesignerSession(designer);
  return NextResponse.redirect(new URL(DESIGNER_HOME, env.siteUrl()));
}
