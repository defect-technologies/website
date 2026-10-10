import { redirect } from "next/navigation";

/** The lead list moved to the Overview's Leads sheet. Old links and bookmarks land there. */
export default function PipelinePage() {
  redirect("/admin/overview?tab=leads");
}
