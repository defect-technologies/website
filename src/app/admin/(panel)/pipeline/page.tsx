import { redirect } from "next/navigation";

/** The lead list is on Leads. */
export default function Moved() {
  redirect("/admin/leads");
}
