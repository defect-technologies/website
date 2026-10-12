import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { brandFolder, BRAND_FILE_TYPES, MAX_BRAND_FILE_BYTES } from "@/lib/brandFiles";
import { currentFounder } from "@/server/auth/session";
import { env } from "@/server/env";
import { businessById } from "@/server/leads/businesses";

/** Hands a signed-in founder's browser a one-time token to upload one brand file straight to Blob, into that lead's folder. */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      token: env.brandFilesToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!(await currentFounder())) throw new Error("Sign in to the admin first.");
        const leadId = pathname.split("/")[1] ?? "";
        if (!pathname.startsWith(brandFolder(leadId)) || !(await businessById(leadId))) throw new Error("That upload isn't for a lead we have.");
        return { allowedContentTypes: [...BRAND_FILE_TYPES], maximumSizeInBytes: MAX_BRAND_FILE_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The upload couldn't start." }, { status: 400 });
  }
}
