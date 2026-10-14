import { redirect } from "next/navigation";

/** Moved under Sites. */
export default function Moved() {
  redirect("/admin/sites/new");
}
