"use client";

import { Hammer, PaperPlaneTilt, X } from "@phosphor-icons/react";
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

/** Who wrote and when, with their own email folded away under it when they wrote one. */
function Origin({ request }: { request: InboundRequest }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-soft text-sm">
        {request.source === "form" ? "Form on defect.tech" : "Email to hello@"}, <When date={request.at} />
        {request.name ? `, from ${request.name}` : ""} ({request.email})
      </p>
      {request.body && (
        <details className="group">
          <summary className="text-ink-soft hover:text-ink w-fit cursor-pointer text-sm font-medium">Their email{request.subject ? `: ${request.subject}` : ""}</summary>
          <p className="bg-paper-shade/60 mt-2 rounded-xl p-3 text-sm whitespace-pre-wrap">{request.body}</p>
        </details>
      )}
      {request.reason && <p className="text-ink-faint text-sm">Client care sorted it: {request.reason}</p>}
    </div>
  );
}

function LeadMatch({ lead }: { lead: MatchedLead }) {
  if (!lead) return null;
  return (
    <Notice tone="warn">
      We already have{" "}
      <Link href={`/admin/pipeline/${lead.id}`} className="font-semibold underline underline-offset-4">
        {lead.businessName}
      </Link>{" "}
      <StageChip stage={lead.stage} />. Building a preview uses that lead, and gives it the request email if we haven&apos;t emailed it yet.
    </Notice>
  );
}

function CardShell({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card id={`request-${id}`} className="flex scroll-mt-8 flex-col gap-4 p-5">
      <h3 className="text-xl font-semibold">{title}</h3>
      {children}
    </Card>
  );
}

/** Someone asked for a website. Building a preview makes them a lead; the fields are what the builder and the email will use. */
export function RequestCard({ request, lead }: { request: InboundRequest; lead: MatchedLead }) {
  const [accepted, accept] = useActionState(acceptRequestAction, IDLE);
  const [declined, decline] = useActionState(declineRequestAction, IDLE);
  const field = (name: string) => `${name}-${request.id}`;
  return (
    <CardShell id={request.id} title={request.businessName || request.email}>
      <Origin request={request} />
      <LeadMatch lead={lead} />
      <form action={accept} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={request.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Business name" id={field("businessName")} name="businessName" defaultValue={request.businessName} required />
          <TextField label="Website" id={field("website")} name="website" defaultValue={request.website} placeholder="Leave empty if they have none" />
          <TextField label="Their name" id={field("name")} name="name" defaultValue={request.name} />
          <TextField label="Email" id={field("email")} name="email" type="email" defaultValue={request.email} required />
        </div>
        <TextAreaField
          label="About the business"
          id={field("about")}
          name="about"
          defaultValue={request.about}
          maxLength={ABOUT_LIMIT}
          rows={4}
          hint={request.website ? "Goes in the lead's notes. The builder reads their website." : "With no website, this is all the builder has. Every fact on the preview comes from here."}
        />
        <Outcome state={accepted} />
        <div>
          <SubmitButton variant="solid" icon={<Hammer size={18} weight="bold" aria-hidden="true" />}>
            Build a preview
          </SubmitButton>
        </div>
      </form>
      <details className="border-ink/8 border-t pt-3">
        <summary className="text-ink-soft hover:text-ink w-fit cursor-pointer text-sm font-medium">Turn it down</summary>
        <form action={decline} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={request.id} />
          <TextAreaField label="Reply (optional)" id={field("decline")} name="reply" rows={4} hint="Sent from hello@defect.tech. Leave it empty to close the request without writing back." />
          <Outcome state={declined} />
          <div>
            <SubmitButton variant="soft" size="sm" icon={<X size={16} weight="bold" aria-hidden="true" />}>
              Turn down
            </SubmitButton>
          </div>
        </form>
      </details>
    </CardShell>
  );
}

/** An email Client care couldn't answer. A founder replies from hello@defect.tech, or closes it. */
export function FounderEmailCard({ request }: { request: InboundRequest }) {
  const [state, action] = useActionState(closeRequestAction, IDLE);
  return (
    <CardShell id={request.id} title={request.subject || request.email}>
      <Origin request={request} />
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={request.id} />
        <TextAreaField label="Reply" id={`reply-${request.id}`} name="reply" rows={5} hint="Sent from hello@defect.tech as the team, in their thread. Sign it the way the team signs." />
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
