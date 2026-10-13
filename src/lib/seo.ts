import type { Metadata } from "next";
import { DEFECT } from "@/content/pricing";

/**
 * The public site's canonical address, for search engines and link previews. Always production:
 * SITE_URL points at localhost in development, and a canonical there would tell crawlers the real
 * site is a copy.
 */
export const SITE_URL = "https://defect.tech";

export const SITE_NAME = "defect.tech";
export const LEGAL_NAME = "Defect Technologies";
export const EMAIL = "hello@defect.tech";
export const DESCRIPTION = "We design beautiful, interactive websites for small businesses and keep them current for $79 a month.";

/** Open Graph fields every page shares. A page's own openGraph replaces its layout's rather than merging, so pages spread this. */
export const OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  siteName: SITE_NAME,
  locale: "en_US",
  images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "defect.tech: websites for small businesses, $79 a month" }],
};

/** Metadata for one public page: its canonical address and matching Open Graph URL. */
export function pageAddress(path: string): Metadata {
  return { alternates: { canonical: path }, openGraph: { ...OPEN_GRAPH, url: path } };
}

/** The public pages, for the sitemap. Everything else is private: the admin, the client portal, editors and preview links. */
export const PUBLIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/start", priority: 0.9, changeFrequency: "monthly" },
  { path: "/team", priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
] as const;

/** Paths crawlers have no business in. */
export const PRIVATE_PATHS = ["/admin", "/api", "/edit", "/portal", "/welcome", "/p/"];

const FOUNDERS = ["Brendan Giang", "Boris Nezlobin"];

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** Schema.org description of the studio, its site and its one service, as one graph for the home page. */
export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: LEGAL_NAME,
        alternateName: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/brand/d-paper-512.png`,
        image: `${SITE_URL}/opengraph-image.png`,
        description: DESCRIPTION,
        email: EMAIL,
        founder: FOUNDERS.map((name) => ({ "@type": "Person", name })),
        contactPoint: { "@type": "ContactPoint", email: EMAIL, contactType: "customer service", availableLanguage: "English" },
        sameAs: ["https://github.com/defect-technologies"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: DESCRIPTION,
        publisher: { "@id": ORGANIZATION_ID },
        inLanguage: "en-US",
      },
      {
        "@type": "Service",
        "@id": `${SITE_URL}/#service`,
        name: "Website design and upkeep for small businesses",
        serviceType: "Website design",
        description: DESCRIPTION,
        provider: { "@id": ORGANIZATION_ID },
        areaServed: { "@type": "Country", name: "United States" },
        audience: { "@type": "BusinessAudience", name: "Small businesses" },
        offers: {
          "@type": "Offer",
          url: `${SITE_URL}/start`,
          priceCurrency: "USD",
          price: DEFECT.monthly[0],
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: DEFECT.monthly[0],
            priceCurrency: "USD",
            unitCode: "MON",
            billingDuration: "P1M",
          },
        },
      },
    ],
  };
}

/** The team page: the two founders, as members of the studio. */
export function teamJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: `${SITE_URL}/team`,
    name: `Team · ${SITE_NAME}`,
    about: { "@id": ORGANIZATION_ID },
    mainEntity: FOUNDERS.map((name) => ({ "@type": "Person", name, jobTitle: "Founder", worksFor: { "@id": ORGANIZATION_ID } })),
  };
}

/** JSON for a script tag, with "<" escaped so no string inside it can close the tag. */
export function jsonLdHtml(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
