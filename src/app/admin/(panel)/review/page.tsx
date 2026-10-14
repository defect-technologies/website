import { redirect } from "next/navigation";

/** The review queue is the top of Today now. */
export default function Moved() {
  redirect("/admin");
}
