import "server-only";
import type { TurnEmail } from "@/lib/turnEmails";
import { env } from "../env";
import { emailFounders } from "../flags/notify";
import { waitingBesides } from "../turn";
import { runnerSettings } from "./settings";

type Options = {
  send?: (subject: string, body: string) => Promise<unknown>;
  /** The lead the email is about, when it goes on To do: the email goes only if nothing else waits there. */
  onYourTurn?: string;
};

async function shouldTell(onYourTurn: string | undefined): Promise<boolean> {
  if (!(await runnerSettings()).tellFounders || env.founderEmails().length === 0) return false;
  return onYourTurn === undefined || (await waitingBesides(onYourTurn)) === 0;
}

/**
 * Emails both founders that something waits for them, unless they switched these emails off in Setup > Runner. A design
 * or a site for To do is emailed only when it is the first thing to wait there. The email is written from the
 * admin's own address, so its links open the admin. It never throws: the runner's report that led here has to be kept
 * whether or not the email goes out. True when it was sent.
 */
export async function tellFounders(compose: (adminUrl: string) => TurnEmail, { send = emailFounders, onYourTurn }: Options = {}): Promise<boolean> {
  try {
    if (!(await shouldTell(onYourTurn))) return false;
    const email = compose(`${env.siteUrl()}/admin`);
    await send(email.subject, email.body);
    return true;
  } catch (error) {
    console.error("[runner] tell founders", error);
    return false;
  }
}
