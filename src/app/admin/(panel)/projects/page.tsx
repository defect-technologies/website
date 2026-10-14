import { redirect } from "next/navigation";

/** Inboxes and health checks are in Setup > Connections. */
export default function Moved() {
  redirect("/admin/setup/connections");
}
