import { redirect } from "next/navigation";

/** The lead list is on Sites. */
export default function Moved() {
  redirect("/admin/sites");
}
