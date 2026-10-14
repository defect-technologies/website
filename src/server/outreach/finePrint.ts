import "server-only";
import { fillTemplate, type OutreachSettings } from "@/lib/emailTemplate";
import type { Business, Stage } from "../db/schema";

const CLIENT_STAGES: Stage[] = ["paid", "live"];

const SALES_FINE_PRINT = ["This is a sales email from Defect Technologies, {address}.", 'Not interested? Reply "no thanks" and we won\'t email again.'].join("\n");

export type FinePrinted = { ok: true; body: string } | { ok: false; error: string };

/**
 * CAN-SPAM covers every sales email, replies included. Paying clients get transactional
 * email and are left alone; anyone else gets the mailing address and a way out, unless the
 * reply already carries the address.
 */
export function withSalesFinePrint(business: Business, body: string, settings: OutreachSettings): FinePrinted {
  if (CLIENT_STAGES.includes(business.stage)) return { ok: true, body };
  const address = settings.mailingAddress.trim();
  if (!address) return { ok: false, error: "Add the mailing address in Setup > Email template first. The law requires it on email to prospects." };
  if (body.includes(address)) return { ok: true, body };
  return { ok: true, body: `${body.trimEnd()}\n\n${fillTemplate(SALES_FINE_PRINT, { address })}` };
}
