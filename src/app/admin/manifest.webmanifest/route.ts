import { NextResponse } from "next/server";
import { TURN_PATH } from "@/lib/turn";

/**
 * The admin as an app on a founder's home screen: it opens on the queue of what waits for them, with no browser bars.
 * The public site keeps its own manifest (src/app/manifest.ts); this one covers /admin only.
 */
export function GET() {
  return NextResponse.json(
    {
      name: "Defect admin",
      short_name: "Defect",
      description: "What waits for a founder: designs to choose and sites to look at.",
      start_url: TURN_PATH,
      scope: "/admin",
      display: "standalone",
      background_color: "#f4f1ea",
      theme_color: "#f4f1ea",
      icons: [
        { src: "/brand/d-paper-180.png", sizes: "180x180", type: "image/png" },
        { src: "/brand/d-paper-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
