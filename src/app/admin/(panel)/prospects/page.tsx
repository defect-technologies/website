import { redirect } from "next/navigation";

/** Prospects are a tab of Businesses. */
export default function Moved() {
  redirect("/admin/sites/prospects");
}
