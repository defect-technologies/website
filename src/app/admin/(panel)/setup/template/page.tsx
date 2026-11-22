import { redirect } from "next/navigation";

/** The email template is on Outreach. */
export default function Moved() {
  redirect("/admin/setup/outreach");
}
