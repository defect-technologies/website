import { requireFounder } from "@/server/auth/session";
import { and, asc, eq, not } from "drizzle-orm";
import type { Metadata } from "next";
import Inboxes, { MAILBOX_NOTICE } from "@/components/admin/setup/Inboxes";
import ResearchForm from "@/components/admin/setup/ResearchForm";
import TemplateEditor from "@/components/admin/TemplateEditor";
import { Notice, PageHeader } from "@/components/admin/ui";
import { offerSentence, type TemplateValues } from "@/lib/emailTemplate";
import { nextSearches } from "@/lib/research";
import { db } from "@/server/db/client";
import { businesses } from "@/server/db/schema";
import { previewExpired } from "@/server/leads/previewExpiry";
import { connectedMailboxes } from "@/server/mail/outbox";
import { templateValues } from "@/server/outreach/compose";
import { researchSettings } from "@/server/research";
import { outreachSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Outreach" };

const MADE_UP: TemplateValues = {
  first_name: "Maria",
  business: "Marigold Bakery",
  problem: "your site still says © 2021 and gets cut off on phones",
  link: "https://defect.tech/p/k3m9q2xa",
  price: "59",
  offer: offerSentence(59),
  sender: "",
  address: "",
};

/** The nightly lead search, the inboxes outreach goes out from, then the emails it sends and how many a day. */
export default async function OutreachPage({ searchParams }: { searchParams: Promise<{ mailbox?: string }> }) {
  await requireFounder();
  const { mailbox } = await searchParams;
  const [settings, inboxes, research] = await Promise.all([outreachSettings(), connectedMailboxes(), researchSettings()]);
  const [next] = await (await db()).select().from(businesses).where(and(eq(businesses.stage, "preview_built"), not(previewExpired()))).orderBy(asc(businesses.previewBuiltAt)).limit(1);
  const sample = next ? templateValues(next, settings) : MADE_UP;
  const notice = mailbox ? MAILBOX_NOTICE[mailbox] : undefined;

  return (
    <>
      <PageHeader title="Outreach" />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <ResearchForm settings={research} tonight={nextSearches(research)} />
      <Inboxes inboxes={inboxes} />
      <TemplateEditor settings={settings} sample={sample} sampleName={next ? `${next.businessName}, next in the queue,` : "a made-up bakery"} />
    </>
  );
}
