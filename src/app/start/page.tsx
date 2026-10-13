import type { Metadata } from "next";
import { pageAddress } from "@/lib/seo";
import PaintedHeadline from "@/components/PaintedHeadline";
import RequestForm from "@/components/RequestForm";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { CONVERSATION } from "@/content/headlines";

export const metadata: Metadata = {
  title: "Request a website",
  description: "Tell us about your business and we'll build it a new website. If you like it, it's $79 a month to keep it live.",
  ...pageAddress("/start"),
};

/** The home page's conversation opens with this question; here the visitor answers it. */
const QUESTION = CONVERSATION[0];

export default function StartPage() {
  return (
    <>
      <SiteNav page="start" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pt-32 pb-[16vh] sm:px-8">
        <PaintedHeadline as="h1" headline={QUESTION} style={{ fontSize: "clamp(2.5rem, 8vw, 6.5rem)" }} />
        <RequestForm />
      </main>
      <SiteFooter />
    </>
  );
}
