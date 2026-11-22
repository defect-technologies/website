import { redirect } from "next/navigation";

/** Moved to Setup > Bots. */
export default function Moved() {
  redirect("/admin/setup/bots");
}
