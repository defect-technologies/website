import Link from "next/link";
import { sentByLine } from "@/lib/senders";
import type { Business, Message } from "@/server/db/schema";
import { domainOf } from "@/server/mail/mime";
import { looksLikeOptOut } from "@/server/mail/sync";
import { OptOutButton, ReplyBox } from "./ThreadControls";
import { ArmChip, Card, Notice, StageChip, When } from "./ui";

function MessageBlock({ message, business }: { message: Message; business: Business }) {
  const ours = message.direction === "out";
  return (
    <article className={`flex flex-col gap-2 rounded-2xl p-4 ${ours ? "bg-paper-shade/60 ml-6 sm:ml-12" : "bg-surface shadow-card mr-6 sm:mr-12"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-semibold">{ours ? sentByLine(message.sentBy) : business.businessName}</span>
        <span className="text-ink-faint">
          {ours ? `to ${message.toAddress}` : message.fromAddress}, <When date={message.at} />
        </span>
      </header>
      <p className="leading-relaxed break-words whitespace-pre-wrap">{message.body}</p>
    </article>
  );
}

/** One business's emails, newest first, with the reply box on top. The heading is left out where the page already names the business. */
export default function Conversation({ business, thread, heading = true }: { business: Business; thread: Message[]; heading?: boolean }) {
  // Newest first, so the latest reply is at the top and the first cold email at the bottom.
  const newestFirst = [...thread].reverse();
  const lastIncoming = newestFirst.find((m) => m.direction === "in");
  const suggestOptOut = Boolean(lastIncoming && looksLikeOptOut(lastIncoming.body)) && business.stage !== "opted_out";
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {heading && (
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold">
              <Link href={`/admin/sites/${business.id}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
                {business.businessName}
              </Link>
            </h2>
            <StageChip stage={business.stage} />
            <ArmChip arm={business.priceArm} />
          </div>
        )}
        {business.stage !== "opted_out" && <OptOutButton businessId={business.id} domain={domainOf(business.email)} suggested={suggestOptOut} />}
      </header>
      {suggestOptOut && <Notice tone="warn">Their last message reads like a no. Mark them opted out?</Notice>}
      {business.stage === "opted_out" ? (
        <Notice tone="bad">Opted out. Nothing more can be sent.</Notice>
      ) : (
        <Card className="p-4">
          <ReplyBox businessId={business.id} to={lastIncoming?.fromAddress ?? business.email} />
        </Card>
      )}
      <ol className="flex flex-col gap-3" aria-label="Messages, newest first">
        {newestFirst.map((message) => (
          <li key={message.id}>
            <MessageBlock message={message} business={business} />
          </li>
        ))}
      </ol>
    </div>
  );
}
