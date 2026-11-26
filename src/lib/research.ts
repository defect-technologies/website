/** The nightly lead search: which niches and areas it goes through, and when each pair was last searched. */
export type ResearchSettings = {
  /** Search each night and add every business that needs a redesign and shows an email as a lead. */
  enabled: boolean;
  niches: string[];
  areas: string[];
  /** One search is one niche in one area: up to three Places Text Search calls. The free tier is 1,000 calls a month. */
  searchesPerNight: number;
  /** "niche|area" to the ISO time it was last searched. */
  searched: Record<string, string>;
};

export type Search = { niche: string; area: string };

export const DEFAULT_RESEARCH: ResearchSettings = { enabled: false, niches: [], areas: [], searchesPerNight: 8, searched: {} };

export const MOST_SEARCHES_PER_NIGHT = 10;

export const searchKey = ({ niche, area }: Search) => `${niche}|${area}`;

/** Every niche in every area, the ones never searched first, then the longest ago. */
export function nextSearches(settings: ResearchSettings): Search[] {
  const pairs = settings.niches.flatMap((niche) => settings.areas.map((area) => ({ niche, area })));
  const lastSearched = (pair: Search) => settings.searched[searchKey(pair)] ?? "";
  return pairs.sort((a, b) => lastSearched(a).localeCompare(lastSearched(b))).slice(0, settings.searchesPerNight);
}

/** One entry per line, trimmed, without blanks or repeats. */
export function listFromLines(text: string): string[] {
  return [...new Set(text.split("\n").map((line) => line.trim()).filter(Boolean))];
}
