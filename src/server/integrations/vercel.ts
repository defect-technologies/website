import "server-only";
import { env } from "../env";
import { getJson, integration } from "./result";

const API = "https://api.vercel.com";
export const PREVIEW_LIFETIME_DAYS = 30;

type Deployment = { uid: string; url: string | null; created: number; readyState: string; target: string | null };
type Project = { id: string; name: string; updatedAt: number };

export type PreviewDeployment = { id: string; url: string; createdAt: Date; state: string };

function vercel<T>(path: string) {
  const { token, teamId } = env.vercel();
  const separator = path.includes("?") ? "&" : "?";
  return getJson<T>(`${API}${path}${separator}teamId=${encodeURIComponent(teamId)}`, { Authorization: `Bearer ${token}` });
}

/** Every preview deployment in the previews project. Production there is the placeholder and is left out. */
export function previewDeployments() {
  const { token, teamId, previewProject } = env.vercel();
  return integration({ VERCEL_TOKEN: token, VERCEL_TEAM_ID: teamId, VERCEL_PREVIEW_PROJECT: previewProject }, async () => {
    const { deployments } = await vercel<{ deployments: Deployment[] }>(
      `/v7/deployments?projectId=${encodeURIComponent(previewProject)}&limit=100`,
    );
    return deployments
      .filter((deployment) => deployment.target !== "production" && deployment.url)
      .map((deployment): PreviewDeployment => ({
        id: deployment.uid,
        url: `https://${deployment.url}`,
        createdAt: new Date(deployment.created),
        state: deployment.readyState,
      }));
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
