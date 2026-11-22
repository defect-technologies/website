import { redirect } from "next/navigation";

/** Requests are on To do now. */
export default function Moved() {
  redirect("/admin");
}
