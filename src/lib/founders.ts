export const FOUNDERS = [
  { name: "Brendan", email: "brendan@g.studio" },
  { name: "Boris", email: "boris.nezlobin@gmail.com" },
] as const;

export const FOUNDER_EMAILS: string[] = FOUNDERS.map((founder) => founder.email);

export function founderName(email: string) {
  return FOUNDERS.find((founder) => founder.email === email.trim().toLowerCase())?.name ?? email;
}
