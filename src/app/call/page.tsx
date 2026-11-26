import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CallBooking from "@/components/CallBooking";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { openCallDays } from "@/server/calls/book";
import { outreachSettings } from "@/server/settings";

export const metadata: Metadata = {
  title: "Book a call",
  description: "Pick a time for a 30-minute video call with Brendan from Defect Technologies.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** The bots send owners here. Until our calendars are set up, or when Google can't answer, it forwards to the booking page in Setup > Outreach. */
export default async function CallPage() {
  const days = await openCallDays();
  if (!days) {
    const { callLink } = await outreachSettings();
    redirect(callLink || "mailto:hello@defect.tech?subject=A%20call");
  }
  return (
    <>
      <SiteNav page="other" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-32 pb-[16vh] sm:px-8">
        <h1 className="font-display text-6xl leading-[0.92] font-black text-balance sm:text-8xl">Book a call with Brendan</h1>
        <CallBooking days={days} />
      </main>
      <SiteFooter />
    </>
  );
}
