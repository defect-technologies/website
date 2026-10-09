import "server-only";

/** Where a domain's records are edited, from the suffix of its nameservers. */
const DNS_HOSTS: [suffix: string, name: string][] = [
  ["ns.cloudflare.com", "Cloudflare"],
  ["domaincontrol.com", "GoDaddy"],
  ["squarespacedns.com", "Squarespace"],
  ["googledomains.com", "Squarespace (formerly Google Domains)"],
  ["wixdns.net", "Wix"],
  ["registrar-servers.com", "Namecheap"],
  ["awsdns", "Amazon Route 53"],
  ["vercel-dns.com", "Vercel"],
  ["name.com", "Name.com"],
  ["hostgator.com", "HostGator"],
  ["bluehost.com", "Bluehost"],
  ["dreamhost.com", "DreamHost"],
  ["ionos.com", "IONOS"],
  ["ui-dns.", "IONOS"],
  ["networksolutions.com", "Network Solutions"],
  ["worldnic.com", "Network Solutions"],
  ["siteground.net", "SiteGround"],
  ["hover.com", "Hover"],
  ["porkbun.com", "Porkbun"],
  ["weebly.com", "Weebly"],
];

const LOOKUP_TIMEOUT_MS = 4000;

export type DomainFacts = {
  domain: string;
  /** The company the domain was bought from, where renewals are billed. */
  registrar: string | null;
  /** The company whose dashboard holds the domain's records: where website records get changed. */
  dnsHost: string | null;
  nameservers: string[];
};

function domainOf(website: string) {
  try {
    return new URL(website.includes("://") ? website : `https://${website}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function fetchJson(url: string, accept: string) {
  try {
    const response = await fetch(url, { headers: { accept, "user-agent": "defect.tech-admin/1.0 (+https://defect.tech)" }, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS), cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function nameserversOf(domain: string): Promise<string[]> {
  const answer = await fetchJson(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=NS`, "application/dns-json");
  const records: { type: number; data: string }[] = answer?.Answer ?? [];
  return records.filter((record) => record.type === 2).map((record) => record.data.replace(/\.$/, "").toLowerCase());
}

type RdapEntity = { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] };

async function registrarOf(domain: string): Promise<string | null> {
  const rdap = await fetchJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, "application/rdap+json");
  const entities: RdapEntity[] = rdap?.entities ?? [];
  const registrar = entities.find((entity) => entity.roles?.includes("registrar"));
  const fullName = registrar?.vcardArray?.[1].find((field) => field[0] === "fn");
  return fullName ? String(fullName[3]) : null;
}

function dnsHostOf(nameservers: string[]) {
  const first = nameservers[0];
  if (!first) return null;
  return DNS_HOSTS.find(([suffix]) => first.includes(suffix))?.[1] ?? first;
}

/** Public facts about the lead's domain, so nobody has to ask the owner where it's managed. */
export async function domainFacts(website: string): Promise<DomainFacts | null> {
  const domain = domainOf(website);
  if (!domain) return null;
  const [nameservers, registrar] = await Promise.all([nameserversOf(domain), registrarOf(domain)]);
  return { domain, registrar, dnsHost: dnsHostOf(nameservers), nameservers };
}
