import type { Metadata } from "next";
import PaintedHeadline from "@/components/PaintedHeadline";
import PaintedPortrait from "@/components/PaintedPortrait";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";
import { TEAM_NAMES, TEAM_TITLE } from "@/content/headlines";

export const metadata: Metadata = {
  title: "Team",
  description: "Brendan Giang and Boris Nezlobin.",
};

const PEOPLE = [
  { key: "brendan", name: "Brendan Giang" },
  { key: "boris", name: "Boris Nezlobin" },
] as const;

const NAME_SIZE = { fontSize: "clamp(2.25rem, 5vw, 3.75rem)" };

export default function TeamPage() {
  return (
    <>
      <SiteNav page="team" />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 pt-32 pb-[16vh] sm:px-8">
        <PaintedHeadline as="h1" headline={TEAM_TITLE} style={{ fontSize: "clamp(3rem, 10vw, 8rem)" }} />
        <div className="grid gap-x-12 gap-y-20 md:grid-cols-2">
          {PEOPLE.map((person) => (
            <figure key={person.key} className="flex flex-col gap-8">
              <PaintedPortrait src={`/team/${person.key}.webp`} alt={`Painted portrait of ${person.name}`} />
              <figcaption className="flex justify-center">
                <PaintedHeadline as="h2" headline={TEAM_NAMES[person.key]} style={NAME_SIZE} />
              </figcaption>
            </figure>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
