import { redirect } from "next/navigation";

/** Open spot checks are on To do; results moved to Setup. */
export default function Moved() {
  redirect("/admin/setup/spot-checks");
}
