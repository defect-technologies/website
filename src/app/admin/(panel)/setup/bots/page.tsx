import { redirect } from "next/navigation";

/** Bot keys and the runner's settings are on Runner. */
export default function Moved() {
  redirect("/admin/setup/runner");
}
