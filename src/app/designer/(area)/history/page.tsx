import { Swatches } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import WorkList from "@/components/admin/designers/WorkList";
import { PageHeader } from "@/components/admin/ui";
import { requireDesigner } from "@/server/auth/designerSession";
import { ledgerOf } from "@/server/designers/pay";
import { DESIGNER_TURN_PATHS, type DesignerBusiness, designerBusinesses } from "@/server/designers/work";

export const metadata: Metadata = { title: "Your designs" };

/** A design waiting on the designer opens where they act on it; any other opens its designs and what was decided. */
function designerHref(business: DesignerBusiness): string | null {
  if (business.status === "your_review") return DESIGNER_TURN_PATHS.review(business.id);
  return business.boardId ? DESIGNER_TURN_PATHS.design(business.boardId) : null;
}

/** Every design the designer took and where it stands now, from the choice through to whether the business signed up. */
export default async function DesignerHistoryPage() {
  const designer = await requireDesigner();
  const businesses = await designerBusinesses(designer.id);
  const { settled } = await ledgerOf(designer.id, businesses);
  return (
    <>
      <PageHeader title="Your designs" />
      {businesses.length ? (
        <WorkList businesses={businesses} hrefFor={designerHref} settled={settled} />
      ) : (
        <EmptyState title="You haven't taken a design yet" action={<ButtonLink href="/designer/pool" variant="solid" icon={<Swatches size={18} aria-hidden="true" />} className="mt-2">Take a design</ButtonLink>}>
          Each design you take stays here with where it stands, through to whether the business signs up.
        </EmptyState>
      )}
    </>
  );
}
