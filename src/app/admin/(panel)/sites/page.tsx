import { redirect } from "next/navigation";

/** Live sites are on Clients. */
export default function Moved() {
  redirect("/admin/clients");
}
