import "server-only";
import { currentDesigner } from "./designerSession";
import { currentFounder } from "./session";

/** Someone signed in as a founder or a designer: one of us, never the business we wrote to. */
export async function isSignedInToDefect(): Promise<boolean> {
  return Boolean((await currentFounder()) ?? (await currentDesigner()));
}
