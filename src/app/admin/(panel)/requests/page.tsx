import { ArrowSquareOut, Prohibit, Storefront } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/admin/EmptyState";
import { FounderEmailCard, RequestCard, type MatchedLead } from "@/components/admin/InboundCards";
import ShowMore from "@/components/admin/ShowMore";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, SectionHeading, When } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { INBOUND_KIND_LABEL, INBOUND_STATUS_LABEL } from "@/lib/inbound";
import type { InboundRequest } from "@/server/db/schema";
import { leadMatcher, openOfKinds, pastRequests, type LeadMatcher } from "@/server/inbound/requests";
import { resortRequestAction } from "./actions";

export const metadata: Metadata = { title: "Requests" };

const matchedLead = (match: LeadMatcher, request: InboundRequest): MatchedLead => {
  const lead = match(request);
  return lead ? { id: lead.id, businessName: lead.businessName, stage: lead.stage } : null;
};

/** Moves an email between kinds by hand: a missed request, or mail that needs no one. */
function ResortButtons({ request, kinds }: { request: InboundRequest; kinds: ("request" | "ignore")[] }) {
  return (
    <form action={resortRequestAction} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={request.id} />
      {kinds.includes("request") && (
        <SubmitButton variant="soft" size="sm" name="kind" value="request" icon={<Storefront size={16} aria-hidden="true" />}>
          It&apos;s a website request
        </SubmitButton>
      )}
      {kinds.includes("ignore") && (
        <SubmitButton variant="ghost" size="sm" name="kind" value="ignore" icon={<Prohibit size={16} aria-hidden="true" />}>
          Ignore
        </SubmitButton>
      )}
    </form>
  );
}

function sender(request: InboundRequest) {
  return request.businessName || request.name || request.email;
}

/** An email the bot hasn't sorted yet, or one it's answering. Shown small: nobody needs to act unless the bot stalls. */
function EmailRow({ request, actions }: { request: InboundRequest; actions?: React.ReactNode }) {
  return (
    <li className="border-ink/8 flex flex-col gap-2 border-b pb-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-medium">{request.subject || "(no subject)"}</p>
        <span className="text-ink-faint text-sm">
          {request.email}, <When date={request.at} />
        </span>
      </div>
      <p className="text-ink-soft line-clamp-3 text-sm whitespace-pre-wrap">{request.body}</p>
      {request.reason && <p className="text-ink-faint text-sm">Client care: {request.reason}</p>}
      {actions}
    </li>
  );
}

function decidedBy(request: InboundRequest) {
  const who = request.decidedBy || request.sortedBy;
  if (!who) return "";
  return who.startsWith("bot:") ? "Client care" : founderName(who);
}

function PastRow({ request }: { request: InboundRequest }) {
  const canReopen = request.status !== "accepted" && request.kind !== "request";
  return (
    <li className="border-ink/8 grid gap-x-4 gap-y-1 border-b pb-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{sender(request)}</span>
        <span className="text-ink-faint">
          <When date={request.at} />
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span>
          {INBOUND_KIND_LABEL[request.kind]}: {INBOUND_STATUS_LABEL[request.status]}
          {decidedBy(request) ? ` by ${decidedBy(request)}` : ""}
        </span>
        <span className="text-ink-faint truncate">{request.reason || request.subject || request.about}</span>
      </div>
      <div className="flex items-start">
        {request.businessId ? (
          <Link href={`/admin/pipeline/${request.businessId}`} className="inline-flex items-center gap-1 font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
            Open the lead <ArrowSquareOut size={14} aria-hidden="true" />
          </Link>
        ) : (
          canReopen && <ResortButtons request={request} kinds={["request"]} />
        )}
      </div>
    </li>
  );
}

function OpenSection({ title, rows, children }: { title: string; rows: InboundRequest[]; children: React.ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-4">
      <SectionHeading count={rows.length}>{title}</SectionHeading>
      {children}
    </section>
  );
}

export default async function RequestsPage() {
  const [requests, founderEmails, unsorted, answering, past, match] = await Promise.all([
    openOfKinds(["request"]),
    openOfKinds(["founder"]),
    openOfKinds(["unsorted"]),
    openOfKinds(["bot"]),
    pastRequests(),
    leadMatcher(),
  ]);
  const nothingOpen = requests.length + founderEmails.length + unsorted.length + answering.length === 0;

  return (
    <>
      <PageHeader title="Requests" />
      {nothingOpen && <EmptyState title="Nothing waiting">Requests from the form on defect.tech, and emails to hello@ that Client care sorts as requests, show up here.</EmptyState>}
      <OpenSection title="Website requests" rows={requests}>
        {requests.map((request) => (
          <RequestCard key={request.id} request={request} lead={matchedLead(match, request)} />
        ))}
      </OpenSection>
      <OpenSection title="Emails that need you" rows={founderEmails}>
        {founderEmails.map((request) => (
          <FounderEmailCard key={request.id} request={request} />
        ))}
      </OpenSection>
      <OpenSection title="Not sorted yet" rows={unsorted}>
        <Card className="p-5">
          <ul className="flex flex-col gap-3">
            {unsorted.map((request) => (
              <EmailRow key={request.id} request={request} actions={<ResortButtons request={request} kinds={["request", "ignore"]} />} />
            ))}
          </ul>
        </Card>
      </OpenSection>
      <OpenSection title="Client care is answering" rows={answering}>
        <Card className="p-5">
          <ul className="flex flex-col gap-3">
            {answering.map((request) => (
              <EmailRow key={request.id} request={request} />
            ))}
          </ul>
        </Card>
      </OpenSection>
      {past.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionHeading count={past.length}>Done</SectionHeading>
          <Card className="p-5">
            <ShowMore items={past.map((request) => <PastRow key={request.id} request={request} />)} />
          </Card>
        </section>
      )}
    </>
  );
}
