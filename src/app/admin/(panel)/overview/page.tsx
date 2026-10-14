import { redirect } from "next/navigation";

/** The Overview's sheets moved to Leads, Clients and Setup. */
export default function Moved() {
  redirect("/admin/leads");
}
