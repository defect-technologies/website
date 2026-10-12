import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { lineIdOf, MAX_VOICE_TAKE_BYTES, VOICE_TAKE_TYPES } from "@/lib/voiceTakes";
import { currentFounder } from "@/server/auth/session";
import { env } from "@/server/env";

/** Hands a signed-in founder's browser a one-time token to upload one voiceover take for a line of the welcome video. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token: env.brandFilesToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!(await currentFounder())) throw new Error("Sign in to the admin first.");
        if (!lineIdOf(pathname)) throw new Error("That take isn't for a line of the script.");
        return { allowedContentTypes: [...VOICE_TAKE_TYPES], maximumSizeInBytes: MAX_VOICE_TAKE_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The upload couldn't start." }, { status: 400 });
  }
}
