import { NextResponse, type NextRequest } from "next/server";
import { PhotoRequest, describePhoto, photoWriterSession } from "@/server/sites/photoWriter";

/** A client site's editor asks here, signed with EDITOR_SECRET, for text written from one photo. */
export async function POST(request: NextRequest) {
  const session = await photoWriterSession(request.headers.get("authorization"));
  if (!session) return NextResponse.json({ ok: false, message: "Your sign-in has expired. Reload the editor and try again." }, { status: 401 });
  const parsed = PhotoRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "That photo's link doesn't look right. Use a photo you uploaded." }, { status: 400 });
  const reply = await describePhoto(session, parsed.data);
  return NextResponse.json(reply.body, { status: reply.status });
}

export const maxDuration = 60;
