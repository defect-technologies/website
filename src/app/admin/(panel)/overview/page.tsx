import { redirect } from "next/navigation";

/** The Overview's sheets moved to Businesses. */
export default function Moved() {
  redirect("/admin/sites");
}
