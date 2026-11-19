import { Swatches } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import WorkList from "@/components/admin/designers/WorkList";
import { PageHeader } from "@/components/admin/ui";
import { requireDesigner } from "@/server/auth/designerSession";
import { DESIGNER_TURN_PATHS, type DesignerBusiness, designerBusinesses } from "@/server/designers/work";

export const metadata: Metadata = { title: "Your businesses" };

/** A business waiting on the designer opens where they act on it; any other opens its designs and what was decided. */
function designerHref(business: DesignerBusiness): string | null {
  if (business.status === "your_review") return DESIGNER_TURN_PATHS.review(business.id);
  return business.boardId ? DESIGNER_TURN_PATHS.design(business.boardId) : null;
}

/** Every business the designer took and where it stands now, from its designs through to whether it became a client. */
export default async function DesignerHistoryPage() {
  const designer = await requireDesigner();
  const businesses = await designerBusinesses(designer.id);
  return (
    <>
      <PageHeader title="Your businesses" />
      {businesses.length ? (
        <WorkList businesses={businesses} hrefFor={designerHref} />
      ) : (
        <EmptyState title="You haven't taken a business yet" action={<ButtonLink href="/designer/pool" variant="solid" icon={<Swatches size={18} aria-hidden="true" />} className="mt-2">Take a business</ButtonLink>}>
          Each business you take stays here, with where it stands, until it becomes a client or says no.
        </EmptyState>
      )}
    </>
  );
}
