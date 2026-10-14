import { redirect } from "next/navigation";

/** Adding a site moved under Clients. */
export default function Moved() {
  redirect("/admin/clients/new");
}
