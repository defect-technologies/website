import "server-only";
import { record } from "../activity";
import { closeFlagsOn } from "../bots/flags";
import type { Business } from "../db/schema";
import { updateBusiness } from "./businesses";

const PREVIEW_ADDRESS = /^https:\/\/[a-z0-9-]+\.vercel\.app\/?$/;

/**
 * A founder has looked at a held preview and it's fine: one the design critic held back goes to the outreach
 * queue; a new one for an owner who already has a preview becomes the one their link shows.
 */
export async function approvePreview(lead: Business, preview: string, founderEmail: string): Promise<boolean> {
  if (lead.stage !== "new") {
    if (!PREVIEW_ADDRESS.test(preview)) return false;
    await updateBusiness(lead.id, { previewUrl: preview });
    await record(founderEmail, "showed the owner a new preview", { businessId: lead.id, detail: preview });
  } else {
    if (!lead.previewUrl) return false;
    await updateBusiness(lead.id, { stage: "preview_built" });
    await record(founderEmail, "approved the preview", { businessId: lead.id });
  }
  await closeFlagsOn(lead.id, ["preview-review"], "A founder marked the preview ready to send.", founderEmail);
  return true;
}
