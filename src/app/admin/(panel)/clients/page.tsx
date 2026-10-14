import { redirect } from "next/navigation";

/** Clients are a filter on Sites. */
export default function Moved() {
  redirect("/admin/sites?status=live");
}
