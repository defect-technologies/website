import { Closing, SavingsSection, WebsitesSection } from "@/components/LandingSections";
import PaintedStage from "@/components/PaintedStage";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

export default function Home() {
  return (
    <>
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
