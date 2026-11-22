import { redirect } from "next/navigation";

/** Inboxes are on Outreach, and health checks on Runner. */
export default function Moved() {
  redirect("/admin/setup/outreach");
}
