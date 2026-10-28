import type { Metadata } from "next";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import PaintedHeadline from "@/components/PaintedHeadline";
import PaintedPortrait from "@/components/PaintedPortrait";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import JsonLd from "@/components/JsonLd";
import { pageAddress, teamJsonLd } from "@/lib/seo";
import { TEAM_NAMES, TEAM_TITLE } from "@/content/headlines";
import { FOUNDERS, TEAM_INTRO, siteLabel } from "@/content/team";

export const metadata: Metadata = {
  title: "Team",
  description: "Brendan Giang and Boris Nezlobin founded defect.tech to design websites for small businesses.",
  ...pageAddress("/team"),
};

const NAME_SIZE = { fontSize: "clamp(2.25rem, 5vw, 3.75rem)" };
const BIO = "text-ink-soft max-w-[40ch] text-lg leading-relaxed text-pretty";
const SITE_LINK =
  "text-ink decoration-ink/30 hover:decoration-ink mt-auto inline-flex items-center gap-1 rounded-md text-lg underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ink";

export default function TeamPage() {
  return (
    <>
      <JsonLd data={teamJsonLd()} />
      <SiteNav page="team" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-32 pb-[16vh] sm:px-8">
        <div className="flex flex-col gap-6">
          <PaintedHeadline as="h1" headline={TEAM_TITLE} style={{ fontSize: "clamp(3rem, 10vw, 8rem)" }} />
          <p className={BIO}>{TEAM_INTRO}</p>
        </div>
        <div className="grid gap-x-12 gap-y-20 md:grid-cols-2">
          {FOUNDERS.map((person) => (
            <figure key={person.key} className="flex flex-col gap-8">
              <PaintedPortrait src={`/team/${person.key}.webp`} alt={`Painted portrait of ${person.name}`} />
              <figcaption className="flex flex-1 flex-col items-center gap-4 text-center">
                <PaintedHeadline as="h2" headline={TEAM_NAMES[person.key]} style={NAME_SIZE} />
                <p className={BIO}>{person.bio}</p>
                <a href={person.site} className={SITE_LINK}>
                  {siteLabel(person)}
                  <ArrowUpRight aria-hidden="true" weight="bold" className="size-4" />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
