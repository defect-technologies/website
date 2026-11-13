import "server-only";
import type { TurnEmail } from "@/lib/turnEmails";
import { env } from "../env";
import { emailFounders } from "../flags/notify";
import { runnerSettings } from "./settings";

/**
 * Emails both founders that something waits for them, unless they switched these emails off in Setup > Bots. The email
 * is written from the admin's own address, so its links open the admin. It never throws: the runner's report that led
 * here has to be kept whether or not the email goes out. True when it was sent.
 */
export async function tellFounders(compose: (adminUrl: string) => TurnEmail, send: (subject: string, body: string) => Promise<unknown> = emailFounders): Promise<boolean> {
  try {
    if (!(await runnerSettings()).tellFounders || env.founderEmails().length === 0) return false;
    const email = compose(`${env.siteUrl()}/admin`);
    await send(email.subject, email.body);
    return true;
  } catch (error) {
    console.error("[runner] tell founders", error);
    return false;
  }
}
