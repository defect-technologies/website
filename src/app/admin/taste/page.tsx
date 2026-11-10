import type { Metadata, Viewport } from "next";
import TasteReviewer from "@/components/admin/taste/TasteReviewer";
import { requireFounder } from "@/server/auth/session";
import { tasteQueue } from "@/server/taste";

export const metadata: Metadata = { title: "Taste review" };

export const viewport: Viewport = { themeColor: "#f4f1ea", viewportFit: "cover" };

export default async function TastePage() {
  await requireFounder();
  return <TasteReviewer initialQueue={await tasteQueue()} />;
}
