import "server-only";
import { isDevelopment } from "../env";

const FETCH_TIMEOUT_MS = 10_000;
const HOME_LIMIT = 120_000;
const PAGE_LIMIT = 40_000;
const CSS_LIMIT = 60_000;
const EXTRA_PAGES = 3;
const STYLESHEETS = 2;

export type PreviewPage = { path: string; html: string };
export type PreviewSource = { pages: PreviewPage[]; css: string };

/** Only our own previews are fetched: a Vercel address, or a local preview server while developing. */
export function isPreviewAddress(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol === "https:" && hostname.endsWith(".vercel.app")) return true;
    return isDevelopment && protocol === "http:" && hostname === "localhost";
  } catch {
    return false;
  }
}

async function fetchText(url: string, limit: number): Promise<string> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: "follow" });
    return response.ok ? (await response.text()).slice(0, limit * 3) : "";
  } catch {
    return "";
  }
}

/** The markup with what can't help a design review taken out: scripts, inline data, long SVG paths and comments. */
export function condenseHtml(html: string, limit: number): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\sd="[^"]{80,}"/g, ' d="…"')
    .replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]+/g, "data:…")
    .replace(/\s(srcset|imagesrcset)="[^"]*"/gi, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, limit);
}

function sameOriginPaths(html: string, origin: string, pattern: RegExp): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    try {
      const url = new URL(match[1], origin);
      if (url.origin === origin) found.add(url.pathname + url.search);
    } catch {
      // A malformed address in the page is skipped.
    }
  }
  return [...found];
}

/** Internal pages the home page links to, skipping files, anchors and the home page itself. */
export function linkedPages(html: string, origin: string): string[] {
  return sameOriginPaths(html, origin, /<a\b[^>]*\shref="([^"#]+)"/gi)
    .filter((path) => path !== "/" && !/\.[a-z0-9]{2,4}$/i.test(path) && !path.startsWith("/_next") && !path.startsWith("/api"))
    .slice(0, EXTRA_PAGES);
}

function stylesheets(html: string, origin: string): string[] {
  return sameOriginPaths(html, origin, /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/gi).slice(0, STYLESHEETS);
}

/** The home page, up to three pages it links to, and its first stylesheets, all as text Claude can read. */
export async function readPreview(previewUrl: string): Promise<PreviewSource | null> {
  if (!isPreviewAddress(previewUrl)) return null;
  const origin = new URL(previewUrl).origin;
  const home = await fetchText(origin + "/", HOME_LIMIT);
  if (!home) return null;
  const extra = linkedPages(home, origin);
  const [pages, sheets] = await Promise.all([
    Promise.all(extra.map(async (path) => ({ path, html: condenseHtml(await fetchText(origin + path, PAGE_LIMIT), PAGE_LIMIT) }))),
    Promise.all(stylesheets(home, origin).map((path) => fetchText(origin + path, CSS_LIMIT))),
  ]);
  return {
    pages: [{ path: "/", html: condenseHtml(home, HOME_LIMIT) }, ...pages.filter((page) => page.html)],
    css: sheets.map((sheet) => sheet.slice(0, CSS_LIMIT)).join("\n"),
  };
}
