import { redirect } from "next/navigation";

/** A founder's turns are at the top of To do. */
export default function Moved() {
  redirect("/admin");
}
