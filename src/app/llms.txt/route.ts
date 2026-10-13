import { DEFECT, priceRange } from "@/content/pricing";
import { DESCRIPTION, EMAIL, LEGAL_NAME, SITE_NAME, SITE_URL } from "@/lib/seo";

/** A plain summary for AI answer engines (llmstxt.org). */
export function GET() {
  const body = `# ${SITE_NAME}

> ${DESCRIPTION}

${LEGAL_NAME} is a website design studio for small businesses, founded by Brendan Giang and Boris Nezlobin. We design each business a new website and keep it current for ${priceRange(DEFECT.monthly)} a month, with nothing to pay up front. When something changes, the owner emails us and we update the site.

## Pages

- [Home](${SITE_URL}/): what we do and what it costs
- [Request a website](${SITE_URL}/start): tell us about your business
- [Team](${SITE_URL}/team): the founders
- [Privacy policy](${SITE_URL}/privacy)
- [Terms of service](${SITE_URL}/terms)

## Contact

${EMAIL}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
