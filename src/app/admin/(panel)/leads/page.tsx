import { redirect } from "next/navigation";

/** Leads and clients are one list on Sites. */
export default function Moved() {
  redirect("/admin/sites");
}
