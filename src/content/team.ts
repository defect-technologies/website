export type Founder = {
  key: "brendan" | "boris";
  name: string;
  site: string;
  bio: string;
};

export const TEAM_INTRO = "Both of us have managed small-business websites that each get more than 100,000 users a year.";

export const FOUNDERS: Founder[] = [
  {
    key: "brendan",
    name: "Brendan Giang",
    site: "https://brendangiang.com",
    bio: "Brendan studies at the USC Iovine and Young Academy and runs G Studio, his film studio. He has won all five hackathons he has entered.",
  },
  {
    key: "boris",
    name: "Boris Nezlobin",
    site: "https://borisnezlobin.com",
    bio: "Boris studies applied math and operations research at UC Berkeley. He has written software for Lockheed Martin's solar lab.",
  },
];

/** A founder's site as people say it out loud: no scheme, no trailing slash. */
export function siteLabel(founder: Founder) {
  return new URL(founder.site).hostname;
}
