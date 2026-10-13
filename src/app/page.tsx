import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { Closing, SavingsSection, WebsitesSection } from "@/components/LandingSections";
import PaintedStage from "@/components/PaintedStage";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { homeJsonLd, pageAddress } from "@/lib/seo";

export const metadata: Metadata = pageAddress("/");

export default function Home() {
  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <SiteNav page="home" />
      <main>
        <PaintedStage />
        <WebsitesSection />
        <SavingsSection />
        <Closing />
      </main>
      <SiteFooter />
    </>
  );
}
