import "server-only";
import { env } from "../env";
import { getJson, integration } from "./result";

const API = "https://api.vercel.com";
export const PREVIEW_LIFETIME_DAYS = 30;

type Deployment = { uid: string; url: string | null; created: number; readyState: string; target: string | null };
type Project = { id: string; name: string; updatedAt: number };

export type PreviewDeployment = { id: string; url: string; title: string; createdAt: Date; state: string };

function vercel<T>(path: string) {
  const { token, teamId } = env.vercel();
  const separator = path.includes("?") ? "&" : "?";
  return getJson<T>(`${API}${path}${separator}teamId=${encodeURIComponent(teamId)}`, { Authorization: `Bearer ${token}` });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
    const hex = code[1] === "x" || code[1] === "X";
    return String.fromCodePoint(parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

/**
 * The preview's own <title>, or its hostname when the page can't be read. A
 * deployment never changes once built, so the answer is cached for good.
 */
async function pageTitle(url: string): Promise<string> {
  const fallback = new URL(url).host;
  try {
    const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(4000) });
    if (!response.ok) return fallback;
    const title = (await response.text()).match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
    return title ? decodeEntities(title) : fallback;
  } catch {
    return fallback;
  }
}

/** Every preview deployment in the previews project. Production there is the placeholder and is left out. */
export function previewDeployments() {
  const { token, teamId, previewProject } = env.vercel();
  return integration({ VERCEL_TOKEN: token, VERCEL_TEAM_ID: teamId, VERCEL_PREVIEW_PROJECT: previewProject }, async () => {
    const { deployments } = await vercel<{ deployments: Deployment[] }>(
      `/v7/deployments?projectId=${encodeURIComponent(previewProject)}&limit=100`,
    );
    const previews = deployments.filter((deployment) => deployment.target !== "production" && deployment.url);
    return Promise.all(
      previews.map(async (deployment): Promise<PreviewDeployment> => {
        const url = `https://${deployment.url}`;
        return {
          id: deployment.uid,
          url,
          title: await pageTitle(url),
          createdAt: new Date(deployment.created),
          state: deployment.readyState,
        };
      }),
    );
  });
}

export function teamProjects() {
  const { token, teamId } = env.vercel();
  return integration({ VERCEL_TOKEN: token, VERCEL_TEAM_ID: teamId }, async () => {
    const response = await vercel<Project[] | { projects: Project[] }>("/v10/projects?limit=100");
    const projects = Array.isArray(response) ? response : response.projects;
    return projects.map((project) => ({ id: project.id, name: project.name, updatedAt: new Date(project.updatedAt) }));
  });
}
