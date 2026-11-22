import { redirect } from "next/navigation";

/** Inboxes are on Setup > Outreach, and health checks on Setup > Runner. */
export default function Moved() {
  redirect("/admin/setup/outreach");
}
