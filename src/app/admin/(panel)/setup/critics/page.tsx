import { redirect } from "next/navigation";

/** Critic settings are on Runner. */
export default function Moved() {
  redirect("/admin/setup/bots");
}
