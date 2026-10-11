import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { Conspicuous, Items, Table, Term, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Defect Technologies collects, uses, discloses and protects personal information.",
};

const EFFECTIVE = "October 11, 2026";

const EMAIL = <a href="mailto:hello@defect.tech">hello@defect.tech</a>;

const PREAMBLE = (
  <>
    <p>
      This Privacy Policy describes how Defect Technologies, a California general partnership (<Term>Defect Technologies</Term>,{" "}
      <Term>we</Term>, <Term>us</Term> or <Term>our</Term>), collects, uses, discloses and protects personal information in connection
      with the website at defect.tech, the private previews we prepare, the websites we design and operate for our clients (
      <Term>Client Sites</Term>), the Client Portal and Site Editor, and our related services (together, the <Term>Services</Term>).
    </p>
    <Conspicuous>
      We do not sell personal information, we do not share it for cross-context behavioral advertising, and our Services are not
      designed to include third-party advertising or cross-site tracking technologies.
    </Conspicuous>
  </>
);

const CATEGORIES: React.ReactNode[][] = [
  [
    "Contact details",
    "Name, business name, email address, telephone number and business address",
    "You; publicly available sources",
    "Contacting prospective clients; providing the Services; responding to inquiries",
  ],
  [
    "Business information",
    "Content published on a business’s website, such as text, photographs and descriptions of its services, and information about the website itself",
    "Publicly available sources; you",
    "Identifying prospective clients; preparing previews; designing and operating Client Sites",
  ],
  [
    "Correspondence",
    "Communications you send us and our replies, including website requests and Change Requests",
    "You",
    "Responding to you; performing the Services; maintaining records",
  ],
  [
    "Account information",
    "Email address, sign-in credentials and records of sign-in activity for the Client Portal and Site Editor",
    "You; third-party sign-in providers",
    "Providing access to the Client Portal and Site Editor; protecting accounts",
  ],
  [
    "Billing information",
    "Subscription and payment history. Payment card details are collected by our payment processor and are not received by us",
    "Our payment processor; you",
    "Billing; accounting and tax compliance",
  ],
  [
    "Domain settings",
    "The configuration of your domain name",
    "Public records; your domain registrar",
    "Connecting your domain to your Client Site",
  ],
  [
    "Usage information",
    "Interactions with links in our emails, information derived from IP addresses, and server logs",
    "Collected automatically",
    "Measuring outreach; preventing abuse; securing the Services",
  ],
  [
    "Client Site analytics",
    "Aggregate counts of visitor interactions with a Client Site",
    "Collected automatically, without cookies",
    "Reporting to our clients",
  ],
];

const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "Scope",
    clauses: [
      {
        title: "Persons covered",
        body: (
          <p>
            This Privacy Policy applies to visitors to defect.tech; owners and staff of businesses that we identify and contact
            (<Term>Prospects</Term>); persons who ask us to design a website; our clients and their authorized users; and visitors to
            Client Sites.
          </p>
        ),
      },
      {
        title: "Relationship to the Terms of Service",
        body: (
          <p>
            Our clients’ use of the Services is also governed by our <Link href="/terms">Terms of Service</Link>. Capitalized terms not
            defined in this Privacy Policy have the meanings given in the Terms of Service.
          </p>
        ),
      },
      {
        title: "Client Sites",
        body: (
          <p>
            We process information about visitors to a Client Site on behalf of the client that owns it. A client that collects personal
            information through its own Client Site, for example through a contact form, is responsible for its own privacy practices.
          </p>
        ),
      },
    ],
  },
  {
    id: "collection",
    title: "Information we collect",
    clauses: [
      {
        title: "Categories of personal information",
        body: (
          <>
            <p>We collect the following categories of personal information, from the sources and for the purposes stated.</p>
            <Table caption="Categories of personal information we collect" head={["Category", "Examples", "Source", "Purpose"]} rows={CATEGORIES} />
          </>
        ),
      },
      {
        title: "Information about Prospects",
        body: (
          <p>
            We identify prospective clients using publicly available business information, such as map listings and a business’s own
            website. We may retain this information for businesses that we review but do not contact.
          </p>
        ),
      },
      {
        title: "Sensitive personal information",
        body: (
          <p>
            We do not request or knowingly collect sensitive personal information, such as government identifiers, financial account
            credentials, precise geolocation or health information.
          </p>
        ),
      },
    ],
  },
  {
    id: "use",
    title: "How we use information",
    body: (
      <>
        <p>We use personal information to:</p>
        <Items>
          {[
            "identify businesses whose websites we may be able to improve, prepare private previews and contact them about our Services;",
            "design, host, maintain and update Client Sites, and process Change Requests;",
            "provide and secure the Client Portal and Site Editor;",
            "bill for the Services and keep financial records;",
            "respond to inquiries and provide support;",
            "monitor, secure and improve the Services and prevent fraud and abuse; and",
            "comply with law and enforce our Terms of Service.",
          ]}
        </Items>
        <p>
          We use automated systems, including artificial intelligence, to help us carry out several of these purposes. These systems do not
          make decisions that produce legal or similarly significant effects concerning any individual.
        </p>
      </>
    ),
  },
  {
    id: "disclosure",
    title: "How we disclose information",
    clauses: [
      {
        title: "Service providers",
        body: (
          <>
            <p>
              We disclose personal information to service providers that process it on our behalf and only to provide their services to us,
              in the following categories:
            </p>
            <Items>
              {[
                "website hosting and analytics providers;",
                "database, file storage and source code hosting providers;",
                "email and account sign-in providers;",
                "payment processors; and",
                "artificial intelligence service providers.",
              ]}
            </Items>
            <p>A list of our current service providers is available on request at {EMAIL}.</p>
          </>
        ),
      },
      {
        title: "Legal requirements",
        body: (
          <p>
            We may disclose personal information where we believe in good faith that disclosure is required by law, subpoena or other legal
            process, or is necessary to protect the rights, property or safety of Defect Technologies, our clients or others.
          </p>
        ),
      },
      {
        title: "Business transfers",
        body: (
          <p>
            Personal information may be transferred to an entity formed by our partners to carry on our business, or to a successor in a
            merger, acquisition or sale of all or part of our business, subject to this Privacy Policy.
          </p>
        ),
      },
      {
        title: "With your consent",
        body: <p>We may disclose personal information for any other purpose with your consent.</p>,
      },
      {
        title: "No sale or sharing",
        body: (
          <Conspicuous>
            We do not sell personal information, we do not share it for cross-context behavioral advertising, and we have not done so in the
            preceding twelve (12) months. We do not disclose personal information to third parties for their own direct marketing purposes.
          </Conspicuous>
        ),
      },
    ],
  },
  {
    id: "cookies",
    title: "Cookies and tracking",
    clauses: [
      {
        title: "defect.tech",
        body: (
          <p>
            Browsing defect.tech does not set cookies, and the site runs no analytics, advertising or third-party tracking technology. When
            you sign in to the Client Portal, the Site Editor or our administrative tools, we set strictly necessary cookies that keep you
            signed in and protect the sign-in process. These cookies expire when you sign out or after a fixed period.
          </p>
        ),
      },
      {
        title: "Client Sites",
        body: (
          <p>
            Client Sites measure visitor interactions using an analytics service that sets no cookies, and are not designed to include
            advertising or cross-site tracking technologies. Client Sites may link to or display content from third-party services chosen by
            our clients, such as booking, ordering, payment or social media services. Those services are governed by their own privacy
            policies, and we are not responsible for their practices.
          </p>
        ),
      },
      {
        title: "Do Not Track and Global Privacy Control",
        body: (
          <p>
            We do not track visitors across third-party websites over time, and our Services are not designed to allow third parties to
            collect personal information about visitors’ online activities over time and across websites, except as described in Section
            5.2 for third-party services that a client chooses. Because we do not engage in such tracking, we do not change our practices in
            response to a Do Not Track signal. We treat a Global Privacy Control signal as a request to opt out of
            the sale or sharing of personal information, which we do not engage in.
          </p>
        ),
      },
    ],
  },
  {
    id: "outreach",
    title: "Outreach to businesses",
    clauses: [
      {
        title: "Our emails",
        body: (
          <p>
            We may email a Prospect about our Services, including a preview of a redesigned website. Each email identifies Defect
            Technologies as the sender.
          </p>
        ),
      },
      {
        title: "Previews",
        body: (
          <p>
            Previews are published at a private address, are excluded from search engines and are deleted thirty (30) days after they are
            created unless the business becomes a client.
          </p>
        ),
      },
      {
        title: "Opting out",
        body: (
          <p>
            You may opt out of further emails by replying to any of them with a request to stop. We will honor the request within ten (10)
            business days and will not contact your business again.
          </p>
        ),
      },
    ],
  },
  {
    id: "retention",
    title: "Retention",
    body: (
      <>
        <p>We retain personal information only as long as reasonably necessary for the purposes described in this Privacy Policy:</p>
        <Items>
          {[
            "previews, for thirty (30) days after they are created, unless the business becomes a client;",
            "suppression list entries, indefinitely, so that an opt-out does not lapse;",
            "information about Prospects, for no more than twenty-four (24) months after we last reviewed or contacted the business, or until you ask us to delete it, whichever is earlier;",
            "client records, for the duration of the Subscription and afterward for as long as required by tax, accounting and other legal obligations;",
            "Client Site content, as provided in Section 13.5 of our Terms of Service; and",
            "server logs, in accordance with our hosting provider’s retention schedule.",
          ]}
        </Items>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <>
        <p>
          We maintain reasonable administrative, technical and physical safeguards designed to protect personal information against loss,
          misuse and unauthorized access, disclosure, alteration and destruction.
        </p>
        <p>No method of transmission or storage is completely secure, and we cannot guarantee the absolute security of personal information.</p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and rights",
    clauses: [
      {
        title: "Access, correction and deletion",
        body: (
          <p>
            You may ask us to tell you what personal information we hold about you or your business, to correct it, or to delete it, by
            emailing {EMAIL}. We will respond within forty-five (45) days, which we may extend once by an additional forty-five (45) days
            where reasonably necessary, in which case we will tell you. We may retain information where required by law, and we retain
            suppression list entries so that we can honor opt-outs.
          </p>
        ),
      },
      {
        title: "Verification",
        body: (
          <p>
            We may take reasonable steps to verify your identity before acting on a request, such as confirming that the request comes from an
            email address associated with the information. An authorized agent may make a request on your behalf with your written
            permission.
          </p>
        ),
      },
      {
        title: "Non-discrimination",
        body: <p>We will not deny you service, charge you a different price or otherwise discriminate against you for making a request.</p>,
      },
    ],
  },
  {
    id: "california",
    title: "California disclosures",
    clauses: [
      {
        title: "California Online Privacy Protection Act",
        body: (
          <p>
            You may review and request changes to your personal information as described in Section 9. We describe how we notify users of
            changes in Section 13, and how we respond to Do Not Track signals in Section 5.3.
          </p>
        ),
      },
      {
        title: "California Consumer Privacy Act",
        body: (
          <p>
            Defect Technologies does not currently meet the thresholds that make a business subject to the California Consumer Privacy Act.
            We nevertheless honor requests to know, correct and delete personal information as described in Section 9, and we do not sell or
            share personal information or use sensitive personal information.
          </p>
        ),
      },
      {
        title: "Shine the Light",
        body: (
          <p>
            California Civil Code Section 1798.83 permits California residents to request information about disclosures of personal
            information to third parties for their direct marketing purposes. We make no such disclosures.
          </p>
        ),
      },
    ],
  },
  {
    id: "international",
    title: "International users",
    body: (
      <p>
        We are based in the United States, and personal information is processed and stored in the United States. Our Services are intended
        for businesses in the United States.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The Services are directed to businesses and are not directed to children. We do not knowingly collect personal information from
        anyone under sixteen (16) years of age. If we learn that we have collected such information, we will delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this Privacy Policy",
    body: (
      <p>
        We may update this Privacy Policy. We will post the updated policy on this page and revise the date at the top. If a change is
        material, we will notify our clients by email before it takes effect.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: <p>Questions and requests concerning this Privacy Policy may be sent to Defect Technologies at {EMAIL}.</p>,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" effective={EFFECTIVE} preamble={PREAMBLE} sections={SECTIONS} />;
}
