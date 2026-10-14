import { redirect } from "next/navigation";

/** The Overview's sheets moved to Sites. */
export default function Moved() {
  redirect("/admin/sites");
}
