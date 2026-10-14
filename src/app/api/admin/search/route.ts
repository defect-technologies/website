import { NextResponse } from "next/server";
import { currentFounder } from "@/server/auth/session";
import { searchSites } from "@/server/search";

/** GET /api/admin/search?q= for the admin's search box. Founders only. */
export async function GET(request: Request) {
  if (!(await currentFounder())) return NextResponse.json({ error: "Sign in to the admin first." }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ hits: await searchSites(q) });
}
