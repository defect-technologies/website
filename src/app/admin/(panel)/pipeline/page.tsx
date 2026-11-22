import { redirect } from "next/navigation";

/** The lead list is on Businesses. */
export default function Moved() {
  redirect("/admin/sites");
}
