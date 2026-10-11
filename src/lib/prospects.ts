/** "copyright_4plus_years" reads as "Copyright 4+ years". The wording owners see lives with the lead finder. */
export function signalLabel(name: string): string {
  const words = name.replace("4plus", "4+").replace("2to3", "2 to 3").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A site score's band, as the lead finder draws the line: 80 or below needs a redesign. */
export function scoreTone(score: number | null): string {
  if (score === null) return "text-ink-faint";
  if (score <= 50) return "text-bad font-semibold";
  if (score <= 80) return "text-warn font-semibold";
  return "text-good";
}
