export const FOUNDERS = [
  { name: "Brendan", email: "brendan@g.studio" },
  { name: "Boris", email: "boris.nezlobin@gmail.com" },
] as const;

export const FOUNDER_EMAILS: string[] = FOUNDERS.map((founder) => founder.email);

/** A founder's name as it appears in the address of their page on Designers. */
export const founderSlug = (name: string) => name.toLowerCase();

export function founderName(email: string) {
  return FOUNDERS.find((founder) => founder.email === email.trim().toLowerCase())?.name ?? email;
}

/** Items grouped by the founder they belong to, keeping their order within each group and the order founders first appear. */
export function byFounder<T extends { by: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.by, [...(groups.get(item.by) ?? []), item]);
  return [...groups];
}
