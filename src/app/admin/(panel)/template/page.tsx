import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import TemplateEditor from "@/components/admin/TemplateEditor";
import { PageHeader } from "@/components/admin/ui";
import type { TemplateValues } from "@/lib/emailTemplate";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { templateValues } from "@/server/outreach/compose";
import { outreachSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Template" };

const MADE_UP: TemplateValues = {
  first_name: "Maria",
  business: "Marigold Bakery",
  problem: "your site still says © 2021 and gets cut off on phones",
  link: "https://defect.tech/p/k3m9q2xa",
  price: "59",
  sender: "",
  address: "",
};

export default async function TemplatePage() {
  const settings = await outreachSettings();
  const [next] = await (await db()).select().from(businesses).where(eq(businesses.stage, "preview_built")).orderBy(asc(businesses.previewBuiltAt)).limit(1);
  const sample = next ? templateValues(next, settings) : MADE_UP;

  return (
    <>
      <PageHeader title="Template" />
      <TemplateEditor settings={settings} sample={sample} sampleName={next ? `${next.businessName}, next in the queue,` : "a made-up bakery"} />
    </>
  );
}
