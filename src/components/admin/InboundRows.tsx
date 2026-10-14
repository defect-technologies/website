import { ArrowRight, Prohibit, Storefront } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { resortRequestAction } from "@/app/admin/(panel)/requests/actions";
import { founderName } from "@/lib/founders";
import { INBOUND_KIND_LABEL, INBOUND_STATUS_LABEL } from "@/lib/inbound";
import type { InboundRequest } from "@/server/db/schema";
import SubmitButton from "./SubmitButton";
import { When } from "./ui";

/** Moves an email between kinds by hand: a missed request, or mail that needs no one. */
export function ResortButtons({ request, kinds }: { request: InboundRequest; kinds: ("request" | "ignore")[] }) {
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

const sender = (request: InboundRequest) => request.businessName || request.name || request.email;

/** An email the bot hasn't sorted yet, or one it's answering. */
export function EmailRow({ request, actions }: { request: InboundRequest; actions?: ReactNode }) {
  return (
    <li className="border-ink/8 flex flex-col gap-2 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-medium">{request.subject || "(no subject)"}</p>
        <span className="text-ink-faint text-sm">
          {request.email}, <When date={request.at} />
        </span>
      </div>
      <p className="text-ink-soft line-clamp-3 text-sm whitespace-pre-wrap" title={request.reason ? `Client care: ${request.reason}` : undefined}>
        {request.body}
      </p>
      {actions}
    </li>
  );
}

function decidedBy(request: InboundRequest) {
  const who = request.decidedBy || request.sortedBy;
  if (!who) return "";
  return who.startsWith("bot:") ? "Client care" : founderName(who);
}

/** A request someone already dealt with. */
export function PastRow({ request }: { request: InboundRequest }) {
  const canReopen = request.status !== "accepted" && request.kind !== "request";
  const by = decidedBy(request);
  return (
    <li className="border-ink/8 grid gap-x-4 gap-y-1 border-b pb-3 text-sm last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
      <span className="truncate font-medium" title={request.reason || request.subject || request.about}>
        {sender(request)}
      </span>
      <span className="text-ink-soft">
        {INBOUND_KIND_LABEL[request.kind]}: {INBOUND_STATUS_LABEL[request.status]}
        {by ? ` by ${by}` : ""}, <When date={request.at} />
      </span>
      <div className="flex items-start">
        {request.businessId ? (
          <Link href={`/admin/leads/${request.businessId}`} className="inline-flex items-center gap-1 font-medium hover:underline">
            Open lead <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : (
          canReopen && <ResortButtons request={request} kinds={["request"]} />
        )}
      </div>
    </li>
  );
}
