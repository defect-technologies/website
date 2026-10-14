import { redirect } from "next/navigation";

/** Requests are on Today now. */
export default function Moved() {
  redirect("/admin");
}
