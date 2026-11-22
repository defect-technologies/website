import { redirect } from "next/navigation";

/** Clients are a filter on Businesses. */
export default function Moved() {
  redirect("/admin/sites?status=live");
}
