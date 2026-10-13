import { jsonLdHtml } from "@/lib/seo";

/** Structured data for search engines and AI answers, rendered into the page's HTML. */
export default function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(data) }} />;
}
