export type Founder = {
  key: "brendan" | "boris";
  name: string;
  site: string;
  bio: string;
};

export const FOUNDERS: Founder[] = [
  {
    key: "brendan",
    name: "Brendan Giang",
    site: "https://brendangiang.com",
    bio: "Brendan studies at USC and runs G Studio, his film studio. He has won all five hackathons he has entered.",
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
