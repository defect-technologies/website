"use client";

import { EnvelopeSimple, Globe, Hammer, PaperPlaneTilt, PencilSimple, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { acceptRequestAction, closeRequestAction, declineRequestAction, type RequestActionState } from "@/app/admin/(panel)/requests/actions";
import { ABOUT_LIMIT } from "@/lib/inbound";
import type { Stage } from "@/lib/stages";
import type { InboundRequest } from "@/server/db/schema";
import { TextAreaField, TextField } from "./fields";
import SubmitButton from "./SubmitButton";
import { Card, Notice, StageChip, When } from "./ui";

const IDLE: RequestActionState = { ok: false, message: "" };

export type MatchedLead = { id: string; businessName: string; stage: Stage } | null;

function Outcome({ state }: { state: RequestActionState }) {
  if (!state.message) return null;
  return <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>;
}

const summaryClass = "text-ink-soft hover:text-ink inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden";

/** Who wrote, how and when, on one line. Client care's reason is in the tooltip. */
function Origin({ request }: { request: InboundRequest }) {
  const SourceIcon = request.source === "form" ? Globe : EnvelopeSimple;
  return (
    <p className="text-ink-faint flex flex-wrap items-center gap-x-2 text-sm" title={request.reason ? `Client care: ${request.reason}` : undefined}>
      <SourceIcon size={16} aria-label={request.source === "form" ? "From the form" : "By email"} />
      <span>{request.name ? `${request.name}, ${request.email}` : request.email}</span>
      <When date={request.at} />
    </p>
  );
}

function TheirWords({ text }: { text: string }) {
  if (!text) return null;
  return <p className="bg-paper-shade/60 max-w-prose rounded-xl p-3 text-sm whitespace-pre-wrap">{text}</p>;
}

function LeadMatch({ lead }: { lead: MatchedLead }) {
  if (!lead) return null;
  return (
    <p className="text-warn flex flex-wrap items-center gap-2 text-sm font-medium" title="Building a preview uses this lead, and gives it the request email if we haven't emailed it yet.">
      <Link href={`/admin/sites/${lead.id}`} className="underline underline-offset-4">
        Same as {lead.businessName}
      </Link>
      <StageChip stage={lead.stage} />
    </p>
  );
}

function CardShell({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={`request-${id}`} className="flex scroll-mt-8 flex-col gap-3 p-5">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </Card>
  );
}

function DeclineForm({ request }: { request: InboundRequest }) {
  const [declined, decline] = useActionState(declineRequestAction, IDLE);
  return (
    <details className="order-last open:basis-full">
      <summary className={summaryClass}>
        <X size={16} aria-hidden="true" />
        Turn down
      </summary>
      <form action={decline} className="mt-2 flex flex-col gap-3">
        <input type="hidden" name="id" value={request.id} />
        <TextAreaField label="Reply (optional)" id={`decline-${request.id}`} name="reply" rows={3} placeholder="Leave empty to close without writing back" />
        <Outcome state={declined} />
        <div>
          <SubmitButton variant="soft" size="sm" icon={<X size={16} weight="bold" aria-hidden="true" />}>
            Turn down
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

/** Build a preview, with the details the builder uses folded away. The form is `contents` so its button and fold sit in the card's action row. */
function AcceptForm({ request, action }: { request: InboundRequest; action: (form: FormData) => void }) {
  const field = (name: string) => `${name}-${request.id}`;
  return (
    <form action={action} className="contents">
      <input type="hidden" name="id" value={request.id} />
      <SubmitButton variant="solid" size="sm" icon={<Hammer size={16} weight="bold" aria-hidden="true" />}>
        Build a preview
      </SubmitButton>
      <details className="order-last open:basis-full" open={!request.businessName}>
        <summary className={summaryClass}>
          <PencilSimple size={16} aria-hidden="true" />
          Edit details
        </summary>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <TextField label="Business name" id={field("businessName")} name="businessName" defaultValue={request.businessName} required />
          <TextField label="Website" id={field("website")} name="website" defaultValue={request.website} placeholder="None" />
          <TextField label="Their name" id={field("name")} name="name" defaultValue={request.name} />
          <TextField label="Email" id={field("email")} name="email" type="email" defaultValue={request.email} required />
          <div className="sm:col-span-2">
            <TextAreaField label="About the business" id={field("about")} name="about" defaultValue={request.about} maxLength={ABOUT_LIMIT} rows={4} />
          </div>
        </div>
      </details>
    </form>
  );
}

/** Someone asked for a website. Building a preview makes them a lead; the folded fields are what the builder and the email use. */
export function RequestCard({ request, lead }: { request: InboundRequest; lead: MatchedLead }) {
  const [accepted, accept] = useActionState(acceptRequestAction, IDLE);
  return (
    <CardShell id={request.id} title={request.businessName || request.email}>
      <Origin request={request} />
      <LeadMatch lead={lead} />
      {request.website ? (
        <a href={request.website} target="_blank" rel="noreferrer" className="w-fit text-sm font-medium underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          {request.website.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        <span className="text-warn text-sm font-medium" title="The builder works only from what they told us.">
          No website
        </span>
      )}
      <TheirWords text={request.about || request.body} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AcceptForm request={request} action={accept} />
        <DeclineForm request={request} />
      </div>
      <Outcome state={accepted} />
    </CardShell>
  );
}

/** An email Client care couldn't answer. A founder replies from hello@defect.tech, or closes it. */
export function FounderEmailCard({ request }: { request: InboundRequest }) {
  const [state, action] = useActionState(closeRequestAction, IDLE);
  return (
    <CardShell id={request.id} title={request.subject || request.email}>
      <Origin request={request} />
      <TheirWords text={request.body} />
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={request.id} />
        <TextAreaField label="Reply from hello@" id={`reply-${request.id}`} name="reply" rows={3} />
        <Outcome state={state} />
        <div className="flex flex-wrap gap-2">
          <SubmitButton variant="solid" size="sm" icon={<PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />}>
            Send reply
          </SubmitButton>
          <SubmitButton variant="ghost" size="sm" formNoValidate name="intent" value="close">
            Close without replying
          </SubmitButton>
        </div>
      </form>
    </CardShell>
  );
}
