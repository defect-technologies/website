import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Conspicuous, Items, Term, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The agreement between Defect Technologies and the businesses whose websites we design, host and maintain.",
};

const EFFECTIVE = "October 11, 2026";

const EMAIL = <a href="mailto:hello@defect.tech">hello@defect.tech</a>;

const PREAMBLE = (
  <>
    <p>
      These Terms of Service (these <Term>Terms</Term>) form a binding agreement between Defect Technologies, a California general
      partnership (<Term>Defect Technologies</Term>, <Term>we</Term>, <Term>us</Term> or <Term>our</Term>), and the business that
      purchases a Subscription (<Term>Client</Term>, <Term>you</Term> or <Term>your</Term>). They govern the Services described below
      and every order placed through our checkout.
    </p>
    <Conspicuous>
      Please read these Terms carefully. They provide that your Subscription renews automatically until you cancel (Section 4.3),
      limit each party’s liability (Section 11) and require the parties to attempt negotiation and mediation before bringing a claim
      in court (Section 14).
    </Conspicuous>
  </>
);

const SECTIONS: LegalSection[] = [
  {
    id: "definitions",
    title: "Definitions",
    body: (
      <>
        <p>Capitalized terms used in these Terms have the following meanings.</p>
        <p>
          <Term>Change Request</Term> means a request from Client to update the content of the Site, submitted as described in Section 3.3.
        </p>
        <p>
          <Term>Client Content</Term> means all text, images, logos, trademarks, prices, hours, contact details and other materials that
          Client provides to us, that we obtain from Client’s existing website, or that Client publishes through the Site Editor.
        </p>
        <p>
          <Term>Client Portal</Term> means the account area at defect.tech/portal through which Client may open the Site Editor, manage
          billing and submit Change Requests.
        </p>
        <p>
          <Term>Fees</Term> means the recurring subscription fees stated on the checkout page through which Client purchases a
          Subscription.
        </p>
        <p>
          <Term>Preview</Term> means a private, unindexed demonstration version of a redesigned website that we prepare before a business
          purchases a Subscription.
        </p>
        <p>
          <Term>Provider Materials</Term> means the software, code, templates, frameworks, components, design systems, tools, processes
          and know-how that we use to create and operate websites, together with any improvements to them, excluding Client Content.
        </p>
        <p>
          <Term>Services</Term> means the website design, hosting, maintenance, content update, reporting and related services described
          in Section 3.
        </p>
        <p>
          <Term>Site</Term> means the website that we design and operate for Client under these Terms.
        </p>
        <p>
          <Term>Site Editor</Term> means the tool through which Client may edit certain content of the Site directly.
        </p>
        <p>
          <Term>Subscription</Term> means Client’s paid, recurring entitlement to the Services on a monthly or yearly billing period.
        </p>
      </>
    ),
  },
  {
    id: "acceptance",
    title: "Acceptance and eligibility",
    clauses: [
      {
        title: "Acceptance",
        body: (
          <p>
            You accept these Terms by indicating your agreement at checkout and completing payment, or by using the Services, whichever
            occurs first. If you do not agree to these Terms, you may not purchase or use the Services.
          </p>
        ),
      },
      {
        title: "Authority",
        body: (
          <p>
            The individual accepting these Terms represents and warrants that they are at least eighteen (18) years of age and have the
            authority to bind the business on whose behalf they accept, and that business is bound by these Terms.
          </p>
        ),
      },
      {
        title: "Business use",
        body: (
          <p>
            The Services are offered solely to businesses and other organizations for commercial purposes. They are not offered for
            personal, family or household use.
          </p>
        ),
      },
    ],
  },
  {
    id: "services",
    title: "The Services",
    clauses: [
      {
        title: "Website design",
        body: (
          <p>
            We will design and build the Site using Client Content, principally the words, photographs and details from Client’s
            existing website. The Site will display correctly on current mobile and desktop browsers and will be designed to conform to
            the Web Content Accessibility Guidelines (WCAG) 2.2, Level AA.
          </p>
        ),
      },
      {
        title: "Hosting and maintenance",
        body: (
          <p>
            For the duration of the Subscription, we will host the Site on third-party infrastructure that we select, apply security
            updates and maintain backups of the Site.
          </p>
        ),
      },
      {
        title: "Change Requests",
        body: (
          <>
            <p>
              Client may submit Change Requests by email to {EMAIL} or through the Client Portal. Change Requests may concern text,
              hours, prices, photographs, announcements and descriptions of services. Small content changes are included without
              additional charge, subject to reasonable use as determined by us in good faith.
            </p>
            <p>
              We aim to publish most Change Requests on the business day we receive them, but we do not guarantee any particular
              completion time.
            </p>
          </>
        ),
      },
      {
        title: "Site Editor",
        body: (
          <p>
            Where available, Client may edit Client Content directly through the Site Editor. Client is solely responsible for content it
            publishes through the Site Editor. We may revert any edit that impairs the operation, security or accessibility of the Site or
            that violates Section 6.
          </p>
        ),
      },
      {
        title: "Search and AI visibility",
        body: (
          <p>
            We will configure the Site so that search engines and AI answer services can find and describe Client’s business. We do not
            control those services, and we do not guarantee any ranking, placement, mention or volume of traffic.
          </p>
        ),
      },
      {
        title: "Reporting",
        body: (
          <p>
            We will provide Client with a monthly report of the number of times visitors selected the Site’s call, booking, directions and
            email controls. We collect these counts without cookies, as described in our <Link href="/privacy">Privacy Policy</Link>.
          </p>
        ),
      },
      {
        title: "Excluded services",
        body: (
          <p>
            The Services do not include new pages, custom features, online stores, logo or brand design, photography or video production,
            paid advertising, or management of Client’s Google Business Profile or other third-party listings. If Client requests an
            excluded service, we will inform Client that the request falls outside the Services and will not charge for it without
            Client’s prior written agreement.
          </p>
        ),
      },
      {
        title: "Automated tools",
        body: (
          <p>
            We use automated systems, including artificial intelligence, to design, review and maintain websites and to answer routine
            correspondence. Our founders supervise these systems, and Client may ask at any time to correspond with one of them directly.
          </p>
        ),
      },
      {
        title: "Changes to the Services",
        body: (
          <p>
            We may modify, improve or replace any part of the Services, provided that no modification materially reduces the Services
            described in this Section 3 during a billing period for which Client has paid.
          </p>
        ),
      },
    ],
  },
  {
    id: "fees",
    title: "Fees and billing",
    clauses: [
      {
        title: "Fees",
        body: (
          <p>
            There is no setup fee. Client will pay the Fees stated on the checkout page through which Client purchased its Subscription,
            for each monthly or yearly billing period, in advance. Where the checkout page or our offer to Client identifies a price as
            continuing for the life of the Subscription, that price will not increase while the Subscription remains active.
          </p>
        ),
      },
      {
        title: "Payment authorization",
        body: (
          <p>
            Payments are processed by Stripe, Inc. (<Term>Stripe</Term>) and are subject to Stripe’s terms. Client authorizes us, through
            Stripe, to charge Client’s designated payment method for all Fees when due. We do not receive or store Client’s full payment
            card number.
          </p>
        ),
      },
      {
        title: "Automatic renewal",
        body: (
          <Conspicuous>
            Your Subscription renews automatically at the end of each billing period for a further period of the same length, and the
            Fees then in effect will be charged to your payment method at the start of each renewal period, until you cancel in
            accordance with Section 13.2. You may cancel at any time from the billing page in the Client Portal or by email to
            hello@defect.tech.
          </Conspicuous>
        ),
      },
      {
        title: "Taxes",
        body: (
          <p>
            The Fees exclude sales, use, value-added and similar taxes. Client is responsible for any such taxes applicable to its
            purchase, other than taxes on our net income.
          </p>
        ),
      },
      {
        title: "Changes to Fees",
        body: (
          <p>
            Subject to Section 4.1, we may change the Fees by giving Client written notice at least thirty (30) days before the change
            takes effect. A change applies from the first billing period that begins after the notice period ends. Client may avoid the
            change by cancelling before that billing period begins.
          </p>
        ),
      },
      {
        title: "Failed payments and suspension",
        body: (
          <p>
            If a payment fails, we will notify Client and Stripe may attempt the charge again. If the Fees remain unpaid fourteen (14) days
            after our notice, we may suspend the Services, including the availability of the Site, until all overdue Fees are paid. We will
            restore the Services promptly once payment is received.
          </p>
        ),
      },
      {
        title: "Refunds",
        body: (
          <p>
            Except as provided in Section 13.4 or as required by applicable law, Fees are non-refundable, and no refund or credit is given
            for any partial billing period.
          </p>
        ),
      },
      {
        title: "Billing disputes",
        body: (
          <p>
            If Client believes a charge is in error, Client should notify us at {EMAIL}. One of our founders will review the charge
            promptly and in good faith and will correct any error.
          </p>
        ),
      },
    ],
  },
  {
    id: "content",
    title: "Client Content and domains",
    clauses: [
      {
        title: "Ownership",
        body: <p>As between the parties, Client retains all right, title and interest in and to Client Content.</p>,
      },
      {
        title: "License to Defect Technologies",
        body: (
          <p>
            Client grants us a non-exclusive, worldwide, royalty-free license to copy, store, reproduce, modify, adapt, format, publish
            and display Client Content solely to provide the Services, for the term of the Subscription and the period described in
            Section 13.5.
          </p>
        ),
      },
      {
        title: "Previews",
        body: (
          <p>
            Before Client purchased a Subscription, we may have prepared a Preview from content that Client published on its existing
            website. By purchasing a Subscription, Client authorizes us to continue using that content for the Site under Section 5.2. We
            delete Previews that are not purchased within thirty (30) days.
          </p>
        ),
      },
      {
        title: "Client representations",
        body: (
          <p>
            Client represents and warrants that it owns or has all rights necessary to provide Client Content and to grant the license in
            Section 5.2, and that Client Content, and our use of it as permitted by these Terms, is accurate, complies with applicable law
            and does not infringe or misappropriate the rights of any third party.
          </p>
        ),
      },
      {
        title: "Domain names",
        body: (
          <>
            <p>
              Client’s domain name remains registered in Client’s name and account. Client authorizes us to modify the domain’s DNS records
              as necessary to direct the domain to the Site. We will limit our changes to the records that serve the website, will not
              modify the records that route Client’s email, and will record the existing configuration before making any change.
            </p>
            <p>Client remains responsible for maintaining and renewing its domain registration.</p>
          </>
        ),
      },
      {
        title: "Client Portal accounts",
        body: (
          <p>
            Client is responsible for keeping its Client Portal sign-in credentials confidential and for all activity under its account.
            Client will notify us promptly at {EMAIL} of any unauthorized access to its account.
          </p>
        ),
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>Client will not use the Site or the Services, and will not ask us to publish content, that:</p>
        <Items>
          {[
            "is unlawful, fraudulent, deceptive, defamatory, obscene or harassing;",
            "infringes or misappropriates any intellectual property, privacy or publicity right of a third party;",
            "contains malicious code or is designed to interfere with any system, network or service;",
            "promotes goods or services that are illegal where offered; or",
            "violates the acceptable use policies of our hosting or payment providers.",
          ]}
        </Items>
        <p>
          We may remove content that violates this Section 6, or suspend the Site if removal is not practicable, and will notify Client
          when we do so.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Intellectual property",
    clauses: [
      {
        title: "Provider Materials",
        body: (
          <p>
            We and our licensors retain all right, title and interest in and to the Provider Materials. Except for the licenses expressly
            granted in these Terms, no right in the Provider Materials is transferred to Client.
          </p>
        ),
      },
      {
        title: "License to the Site",
        body: (
          <p>
            We grant Client a perpetual, non-exclusive, royalty-free license to use, copy, modify and host the files of the Site that we
            deliver to Client, including any Provider Materials incorporated in them, solely to operate Client’s own website. Client may not
            sell, sublicense or distribute the Provider Materials separately from the Site.
          </p>
        ),
      },
      {
        title: "Feedback",
        body: (
          <p>
            If Client provides suggestions or feedback about the Services, we may use them without restriction or obligation to Client.
          </p>
        ),
      },
    ],
  },
  {
    id: "third-parties",
    title: "Third-party services",
    body: (
      <p>
        The Services depend on third-party providers, including hosting providers, Stripe and Client’s domain registrar. Their services are
        subject to their own terms. We are not responsible for an outage, error or act of a third-party provider that is beyond our
        reasonable control, but we will use commercially reasonable efforts to restore the Services affected by it.
      </p>
    ),
  },
  {
    id: "confidentiality",
    title: "Confidentiality",
    body: (
      <>
        <p>
          Each party will keep confidential any non-public information that the other party discloses in connection with the Services and
          that a reasonable person would understand to be confidential, and will use it only to perform under these Terms. This obligation
          does not apply to information that is or becomes public through no fault of the receiving party, that the receiving party already
          knew or independently developed, or that it must disclose by law, provided that it gives the other party reasonable notice where
          lawful.
        </p>
        <p>
          Our collection and use of personal information is described in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "warranties",
    title: "Warranties and disclaimers",
    clauses: [
      {
        title: "Performance",
        body: <p>We warrant that we will perform the Services in a professional and workmanlike manner consistent with generally accepted industry standards.</p>,
      },
      {
        title: "Accessibility",
        body: (
          <p>
            If Client or a visitor to the Site reports that any part of the Site does not conform to WCAG 2.2, Level AA, we will use
            commercially reasonable efforts to correct the nonconformity promptly at no additional charge.
          </p>
        ),
      },
      {
        title: "Disclaimer",
        body: (
          <Conspicuous>
            Except as expressly provided in this Section 10, the Services and the Site are provided “as is” and “as available,” and we
            disclaim all other warranties, express, implied or statutory, including any implied warranties of merchantability, fitness for
            a particular purpose, title and non-infringement. We do not warrant that the Services or the Site will be uninterrupted or
            error-free, that they will produce any particular search ranking, traffic or revenue, or that the Site satisfies legal
            requirements specific to Client’s business or industry, for which Client remains responsible.
          </Conspicuous>
        ),
      },
    ],
  },
  {
    id: "liability",
    title: "Limitation of liability",
    clauses: [
      {
        title: "Cap on liability",
        body: (
          <Conspicuous>
            To the fullest extent permitted by law, each party’s total liability arising out of or relating to these Terms or the Services,
            under any theory of liability, will not exceed the total Fees paid by Client to us in the twelve (12) months preceding the
            event giving rise to the claim.
          </Conspicuous>
        ),
      },
      {
        title: "Excluded damages",
        body: (
          <Conspicuous>
            To the fullest extent permitted by law, neither party will be liable for any lost profits, lost revenue, loss of data, loss of
            goodwill, or any indirect, incidental, special, consequential, exemplary or punitive damages, even if advised of their
            possibility.
          </Conspicuous>
        ),
      },
      {
        title: "Exceptions",
        body: (
          <p>
            Sections 11.1 and 11.2 do not limit Client’s obligation to pay Fees, either party’s obligations under Section 12, or liability
            for fraud, gross negligence or willful misconduct.
          </p>
        ),
      },
    ],
  },
  {
    id: "indemnification",
    title: "Indemnification",
    clauses: [
      {
        title: "By Client",
        body: (
          <p>
            Client will defend Defect Technologies and its partners against any claim by a third party arising from Client Content, from
            Client’s breach of Section 5.4 or Section 6, or from the operation of Client’s business, and will pay any damages, costs and
            reasonable attorneys’ fees finally awarded or agreed in settlement.
          </p>
        ),
      },
      {
        title: "By Defect Technologies",
        body: (
          <p>
            We will defend Client against any claim by a third party alleging that the Provider Materials, as delivered by us, infringe
            that party’s United States copyright or trademark, and will pay any damages, costs and reasonable attorneys’ fees finally
            awarded or agreed in settlement. This obligation does not apply to claims arising from Client Content or from modifications not
            made by us.
          </p>
        ),
      },
      {
        title: "Procedure",
        body: (
          <p>
            The party seeking defense will notify the other party promptly of the claim, give it sole control of the defense and
            settlement, and provide reasonable cooperation at its expense. No settlement may impose any obligation on, or admit fault on
            behalf of, the indemnified party without its prior written consent.
          </p>
        ),
      },
    ],
  },
  {
    id: "termination",
    title: "Term and termination",
    clauses: [
      {
        title: "Term",
        body: <p>These Terms take effect when Client accepts them and continue until the Subscription ends under this Section 13.</p>,
      },
      {
        title: "Cancellation by Client",
        body: (
          <p>
            Client may cancel its Subscription at any time from the billing page in the Client Portal or by email to {EMAIL}. Cancellation
            takes effect at the end of the billing period for which Client has paid, and the Services continue until then.
          </p>
        ),
      },
      {
        title: "Termination for cause",
        body: (
          <p>
            Either party may terminate these Terms by written notice if the other party materially breaches them and fails to cure the
            breach within thirty (30) days after receiving written notice describing it.
          </p>
        ),
      },
      {
        title: "Discontinuation of the Services",
        body: (
          <p>
            If we discontinue the Services or cease operations, we will give Client at least twenty-one (21) days’ written notice, deliver
            the files of the Site to Client in accordance with Section 13.5, and refund any Fees prepaid for a yearly Subscription
            attributable to full months remaining after the Services end.
          </p>
        ),
      },
      {
        title: "Effect of termination",
        body: (
          <>
            <p>When a Subscription ends for any reason:</p>
            <Items>
              {[
                "we will deliver to Client a copy of the files of the Site, including Client Content, in a standard format that another host can serve;",
                "we will keep the Site online for not less than thirty (30) days after Client submits notice of cancellation, or through the end of the paid billing period if later, so that Client may move the Site;",
                "we will provide reasonable cooperation in directing Client’s domain to a new host;",
                "after that period, we may take the Site offline and delete Client Content from our active systems, except copies retained in routine backups or as required by law; and",
                "any Fees accrued before termination remain payable.",
              ]}
            </Items>
          </>
        ),
      },
      {
        title: "Survival",
        body: (
          <p>
            Sections 4.7, 5.1, 7, 9, 10.3, 11, 12, 13.5, 14, 15 and 17 survive the expiration or termination of these Terms.
          </p>
        ),
      },
    ],
  },
  {
    id: "disputes",
    title: "Dispute resolution",
    clauses: [
      {
        title: "Informal negotiation",
        body: (
          <p>
            Before bringing any claim, a party will notify the other in writing, describing the dispute and the relief sought, and the
            parties will negotiate in good faith for at least thirty (30) days to resolve it.
          </p>
        ),
      },
      {
        title: "Mediation",
        body: (
          <p>
            If the dispute is not resolved by negotiation, the parties will attempt non-binding mediation before a mutually agreed mediator
            in Los Angeles County, California, sharing the mediator’s fees equally.
          </p>
        ),
      },
      {
        title: "Venue",
        body: (
          <p>
            If mediation does not resolve the dispute within sixty (60) days after it is requested, either party may bring an action in
            the state or federal courts located in Los Angeles County, California, and each party consents to the personal jurisdiction of
            those courts. Either party may instead bring an individual claim in small claims court.
          </p>
        ),
      },
      {
        title: "Equitable relief",
        body: (
          <p>
            Nothing in this Section 14 prevents a party from seeking temporary or preliminary injunctive relief to protect its intellectual
            property or confidential information.
          </p>
        ),
      },
    ],
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the State of California, without regard to its conflict of laws principles. The United
        Nations Convention on Contracts for the International Sale of Goods does not apply.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may amend these Terms. We will email Client at least thirty (30) days before a material amendment takes effect and will update
        the date at the top of this page. An amendment takes effect at the start of Client’s next billing period after the notice period
        ends, and continued use of the Services after that date constitutes acceptance. If Client does not agree to an amendment, Client
        may cancel before it takes effect. An amendment does not apply to a dispute of which a party gave notice before the amendment took
        effect.
      </p>
    ),
  },
  {
    id: "general",
    title: "General provisions",
    clauses: [
      {
        title: "Entire agreement",
        body: (
          <p>
            These Terms, together with the checkout page for Client’s Subscription and our <Link href="/privacy">Privacy Policy</Link>,
            are the entire agreement between the parties about the Services and supersede all prior proposals and understandings. If they
            conflict, these Terms control, except that the checkout page controls as to the amount of the Fees.
          </p>
        ),
      },
      {
        title: "Notices",
        body: (
          <p>
            Notices to us must be sent by email to {EMAIL}. Notices to Client will be sent to the email address associated with its
            Subscription. A notice is given when sent, unless the sender receives notice that it was not delivered.
          </p>
        ),
      },
      {
        title: "Assignment",
        body: (
          <p>
            Client may not assign these Terms without our prior written consent, except to a successor to all or substantially all of its
            business. We may assign these Terms to an entity formed by our partners to carry on the business of Defect Technologies, or to a
            successor to all or substantially all of that business, on notice to Client.
          </p>
        ),
      },
      {
        title: "Force majeure",
        body: (
          <p>
            Neither party is liable for a delay or failure to perform, other than a payment obligation, caused by events beyond its
            reasonable control, including natural disasters, failures of public utilities or networks, outages of third-party providers,
            acts of government and labor disputes.
          </p>
        ),
      },
      {
        title: "Independent contractors",
        body: (
          <p>
            The parties are independent contractors. Nothing in these Terms creates a partnership, joint venture, agency or employment
            relationship between them.
          </p>
        ),
      },
      {
        title: "Severability and waiver",
        body: (
          <p>
            If any provision of these Terms is held unenforceable, it will be enforced to the maximum extent permissible and the remaining
            provisions remain in effect. A waiver of any provision is effective only if in writing, and a failure to enforce a provision is
            not a waiver of it.
          </p>
        ),
      },
      {
        title: "Interpretation",
        body: (
          <p>
            Headings are for convenience only. The words “including” and “include” mean “including without limitation.” These Terms will
            not be construed against either party as the drafter.
          </p>
        ),
      },
      {
        title: "Electronic communications",
        body: (
          <p>
            Each party consents to receiving communications electronically and agrees that electronic acceptance of these Terms has the same
            effect as a handwritten signature.
          </p>
        ),
      },
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions about these Terms may be sent to Defect Technologies at {EMAIL}.</p>,
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of service" effective={EFFECTIVE} preamble={PREAMBLE} numbered sections={SECTIONS} />;
}
