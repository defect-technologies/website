import { redirect } from "next/navigation";

/** Open spot checks are on Today; results moved to Setup. */
export default function Moved() {
  redirect("/admin/setup/spot-checks");
}
