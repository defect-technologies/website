import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Defect Technologies collects, why, who we share it with, and how to have it deleted.",
};

const EFFECTIVE = "October 8, 2026";

const SUMMARY: [string, React.ReactNode][] = [
  ["This site", "No cookies, no analytics, no ads."],
  ["If we emailed you", "We used what your own website publishes to build you a private preview. Reply \"no thanks\" and we'll never email you again."],
  ["Client sites", "Clicks on Call, Book, Directions, and Email are counted without cookies. Nothing else is tracked."],
  ["Selling data", "We never sell personal information or use it for ads."],
  ["Questions", <a key="mail" href="mailto:hello@defect.tech">hello@defect.tech</a>],
];

const SECTIONS: LegalSection[] = [
  {
    id: "visitors",
    title: "Visiting defect.tech",
    body: (
      <p>
        This site sets no cookies and runs no analytics or ad trackers, and its fonts are served from our own domain. Vercel, which
        hosts the site, keeps standard server logs such as your IP address and browser type so it can deliver the pages and protect
        them from abuse.
      </p>
    ),
  },
  {
    id: "prospects",
    title: "Businesses we contact",
    body: (
      <>
        <p>We find businesses through Google Maps and public business directories. From Google we keep only its ID for each place. Everything else comes from the business&apos;s own website:</p>
        <ul>
          <li>the business name, website address, and the email address the site publishes</li>
          <li>the site&apos;s text and photos, which we use to build a private preview of a refreshed version</li>
          <li>the platform the site is built on, and signs that it&apos;s out of date</li>
        </ul>
        <p>
          We send one email with a link to the preview, and one follow-up if you don&apos;t reply. The link goes through defect.tech
          first, so we can tell whether it was opened. We keep your replies so we can answer them.
        </p>
        <p>
          Previews have a private address, are hidden from search engines, and are deleted after 30 days. If you reply &ldquo;no
          thanks,&rdquo; we keep your email domain on a do-not-contact list so nobody at your business hears from us again. To have
          everything else about your business deleted, email us.
        </p>
      </>
    ),
  },
  {
    id: "clients",
    title: "Clients",
    body: (
      <>
        <p>When you sign up, we keep what we need to run your site and bill you:</p>
        <ul>
          <li>your name, business name, email address, and phone number</li>
          <li>your site&apos;s content and every change you ask for</li>
          <li>a copy of your domain&apos;s settings, saved before we point the domain at your new site</li>
          <li>your plan and payment history from Stripe, which handles your card. We never see the full card number</li>
        </ul>
      </>
    ),
  },
  {
    id: "client-sites",
    title: "Visitors to our clients' sites",
    body: (
      <>
        <p>
          Sites we run count clicks on their Call, Book, Directions, and Email buttons using Vercel Web Analytics. It sets no cookies.
          Each visitor is counted with an anonymous code that is thrown away after 24 hours. The counts go into the business&apos;s
          monthly report.
        </p>
        <p>The sites have no ad trackers, no session recording, no embedded maps, and no fonts loaded from other companies.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>We use these companies to run the business, and each one handles data only to provide its service to us:</p>
        <ul>
          <li><strong>Vercel</strong> hosts this site, the previews, and our clients&apos; sites, and counts clicks on client sites</li>
          <li><strong>Neon</strong> stores our records of businesses and emails</li>
          <li><strong>Google Workspace</strong> carries our email</li>
          <li><strong>Stripe</strong> takes payments</li>
          <li><strong>Anthropic</strong> provides the AI model that turns a business&apos;s website text into the words for its preview</li>
        </ul>
        <p>We never sell personal information, and we never share it for advertising.</p>
      </>
    ),
  },
  {
    id: "keeping",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Previews are deleted after 30 days.</li>
        <li>Do-not-contact entries are kept for good, so an opt-out never lapses.</li>
        <li>Client records are kept while you&apos;re a client and afterward for as long as tax and accounting rules require.</li>
      </ul>
    ),
  },
  {
    id: "choices",
    title: "Your choices",
    body: (
      <p>
        Email <a href="mailto:hello@defect.tech">hello@defect.tech</a> to see what we have about you or your business, to correct it,
        or to have it deleted. We&apos;ll answer within 30 days. To stop our emails, reply &ldquo;no thanks&rdquo; to any of them.
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Only the two founders can see our records, and they sign in with Google. Connections to email accounts are stored encrypted.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>Our service is for businesses. We don&apos;t knowingly collect information from anyone under 13.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If this policy changes, we&apos;ll update the date at the top. Clients get an email first if the change affects them. Our{" "}
        <Link href="/terms">terms of service</Link> cover the rest of our agreement with clients.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" effective={EFFECTIVE} summary={SUMMARY} sections={SECTIONS} />;
}
