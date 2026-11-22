import { redirect } from "next/navigation";

/** Leads and clients are one list on Businesses. */
export default function Moved() {
  redirect("/admin/sites");
}
