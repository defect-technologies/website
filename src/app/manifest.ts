import type { MetadataRoute } from "next";
import { DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DESCRIPTION,
    start_url: "/",
    display: "browser",
    background_color: "#f4f1ea",
    theme_color: "#17161a",
    icons: [
      { src: "/brand/d-paper-180.png", sizes: "180x180", type: "image/png" },
      { src: "/brand/d-paper-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
