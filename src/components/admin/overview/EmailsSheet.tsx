import { ArrowDownLeft, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { senderName } from "@/lib/senders";
import type { EmailRow } from "@/server/overview";
import { Cell, EmptyRow, RowHeader, Sheet, SheetBody, SheetRow } from "../sheet";
import { When } from "../ui";

const COLUMNS = ["When", "Business", "From", "Email"];

function From({ email }: { email: EmailRow }) {
  const incoming = email.direction === "in";
  const Arrow = incoming ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className="inline-flex items-center gap-1.5 lg:whitespace-nowrap">
      <Arrow size={14} weight="bold" className={`shrink-0 ${incoming ? "text-ink" : "text-ink-faint"}`} aria-hidden="true" />
      {incoming ? (
        <span className="min-w-0 wrap-anywhere">{email.fromAddress}</span>
      ) : (
        <span>
          {senderName(email.sentBy)}
          <span className="text-ink-faint max-lg:hidden">, {email.fromAddress}</span>
        </span>
      )}
    </span>
  );
}

/** Every email to and from a lead or client, newest first. Mail sent straight from Gmail shows as sent from Gmail. */
export default function EmailsSheet({ rows }: { rows: EmailRow[] }) {
  return (
    <Sheet caption="Emails" columns={COLUMNS}>
      <SheetBody>
        {rows.length === 0 && <EmptyRow span={COLUMNS.length}>No emails yet. Sent and received mail shows up here after each mail check.</EmptyRow>}
        {rows.map((email) => {
          const unread = email.direction === "in" && !email.readAt;
          return (
            <SheetRow key={email.id}>
              <Cell className="text-ink-faint whitespace-nowrap">
                <When date={email.at} />
              </Cell>
              <RowHeader className="lg:min-w-40">
                <Link href={`/admin/messages?b=${email.businessId}`} className="hover:underline focus-visible:outline-2 focus-visible:outline-ink">
                  {email.businessName}
                </Link>
              </RowHeader>
              <Cell label="From">
                <From email={email} />
              </Cell>
              <Cell className="lg:max-w-[32rem] lg:min-w-72">
                <span className={`flex items-center gap-2 ${unread ? "font-semibold" : "font-medium"}`}>
                  {unread && <span className="bg-vermilion size-2 shrink-0 rounded-full" aria-hidden="true" />}
                  {email.subject || "No subject"}
                  {unread && <span className="sr-only">, unread</span>}
                </span>
                <span className="text-ink-soft line-clamp-1" title={email.body.slice(0, 600)}>
                  {email.body}
                </span>
              </Cell>
            </SheetRow>
          );
        })}
      </SheetBody>
    </Sheet>
  );
}
