import { redirect } from "next/navigation";

/** Expenses are on Money. */
export default function Moved() {
  redirect("/admin/money");
}
