import { redirect } from "next/navigation";

/** Each client's editor lives on their own site at /edit. This address only hands out sign-in links. */
export default function EditorHome() {
  redirect("/edit/sign-in");
}
