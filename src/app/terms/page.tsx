import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "The agreement between Defect Technologies and the businesses whose websites we run.",
};

const EFFECTIVE = "October 8, 2026";

const SUMMARY: [string, React.ReactNode][] = [
  ["Price", "$0 to set up. Then $59 or $79 a month, or $590 or $790 a year, as shown on your checkout page."],
  ["Changes", "Email us a change and it's usually live the same day. Small content changes are unlimited within reason."],
  ["Ownership", "Your domain and your content stay yours."],
  ["Cancelling", "Cancel anytime. You get your site files, and your site stays online for at least 30 days."],
  ["If we close", "21 days' notice, your files, and a refund of any unused months on a yearly plan."],
];

const SECTIONS: LegalSection[] = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <>
        <p>
          Defect Technologies is a general partnership in California run by Brendan Giang and Boris Nezlobin. In these terms,
          &ldquo;we&rdquo; means Defect Technologies and &ldquo;you&rdquo; means the business that signs up.
        </p>
        <p>
          You accept these terms when you pay at checkout. You can reach us at <a href="mailto:hello@defect.tech">hello@defect.tech</a>.
        </p>
      </>
    ),
  },
  {
    id: "included",
    title: "What the plan includes",
    body: (
      <ul>
        <li>A rebuilt version of your website made from your current site&apos;s words, photos, and details. It works on phones and is built to WCAG 2.2 AA, the common accessibility standard.</li>
        <li>Hosting, security updates, and backups.</li>
        <li>Changes by email to text, hours, prices, photos, announcements, and services. Small changes are unlimited within reason, and most are live the same day. Same-day changes are our aim, not a promise.</li>
        <li>Setup so search engines and AI answer tools can find and describe your business. Nobody can promise a ranking or a mention, and we don&apos;t.</li>
        <li>A monthly report of clicks on your Call, Book, Directions, and Email buttons.</li>
        <li>A billing page where you can update your card, switch to yearly, or cancel.</li>
      </ul>
    ),
  },
  {
    id: "not-included",
    title: "What it doesn't include",
    body: (
      <p>
        New pages, custom features, online stores, logo or brand design, photo or video shoots, paid ads, and managing your Google
        Business Profile. If you ask for one of these, we&apos;ll tell you it&apos;s outside the plan rather than charge you for it.
      </p>
    ),
  },
  {
    id: "billing",
    title: "Price and billing",
    body: (
      <>
        <p>
          There&apos;s no setup fee. Your price is the one on the checkout page you paid through: $59 or $79 a month, or $590 or $790 a
          year. Stripe takes the payment, and we never see your full card number.
        </p>
        <p>
          You pay at the start of each month or year, and the plan renews automatically until you cancel. If you think a charge is
          wrong, email us and a founder will look at it.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content and your domain",
    body: (
      <>
        <p>
          Everything you give us, and everything we take from your current website, stays yours. You let us copy, edit, and publish it
          so we can run your site. You confirm you have the right to use it.
        </p>
        <p>
          Before you signed up, we may have built a private preview from your public website. Paying lets us keep using that content
          for your live site. Previews nobody pays for are deleted after 30 days.
        </p>
        <p>
          Your domain stays in your own account. When we point it at your new site, we change only the records for your website. We
          never touch the records that run your email, and we save a copy of your settings first.
        </p>
      </>
    ),
  },
  {
    id: "accessibility",
    title: "Accessibility",
    body: (
      <p>
        Your site is built to WCAG 2.2 AA, and we check it after every change. If you or a visitor finds something that doesn&apos;t
        work with a screen reader, keyboard, or other assistive tool, email us and we&apos;ll fix it.
      </p>
    ),
  },
  {
    id: "cancelling",
    title: "Cancelling",
    body: (
      <>
        <p>
          You can cancel anytime from your billing page or by emailing us. Your plan runs to the end of the period you&apos;ve paid for.
        </p>
        <p>
          When you cancel, we send you your site&apos;s files. Your site stays online for at least 30 days after you cancel, which gives
          you time to move it.
        </p>
      </>
    ),
  },
  {
    id: "shutdown",
    title: "If we shut down",
    body: (
      <p>
        If Defect Technologies closes, every client gets at least 21 days&apos; notice and their site&apos;s files. If you paid for a
        year, we refund the months you haven&apos;t used.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <p>
        If something goes wrong, the most we owe you is what you paid us in the 12 months before it happened.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        If we change these terms, we&apos;ll email you before the change takes effect and update the date at the top of this page. The
        way we handle personal information is described in our <Link href="/privacy">privacy policy</Link>.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: <p>California law governs these terms. If we disagree, we&apos;ll talk first, then try mediation.</p>,
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of service" effective={EFFECTIVE} summary={SUMMARY} sections={SECTIONS} />;
}
