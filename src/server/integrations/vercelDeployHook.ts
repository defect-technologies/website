import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** Vercel signs each webhook body with the webhook's secret: HMAC-SHA1, hex, in `x-vercel-signature`. */
export function isSignedByVercel(rawBody: string, signature: string | null, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha1", secret).update(rawBody).digest("hex"));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const DeploymentSucceeded = z.object({
  type: z.literal("deployment.succeeded"),
  payload: z.object({
    target: z.string().nullish(),
    project: z.object({ id: z.string() }).nullish(),
    deployment: z.object({
      name: z.string().nullish(),
      url: z.string().min(1),
      meta: z.record(z.string(), z.unknown()).nullish(),
    }),
  }),
});

export type LeadPreviewDeploy = { slug: string; previewUrl: string };

/**
 * The lead preview a webhook event announces: a finished, non-production deployment in the previews project
 * whose deploy was tagged `--meta lead=<slug>`. Anything else returns null.
 */
export function leadPreviewFrom(event: unknown, previewProject: string): LeadPreviewDeploy | null {
  const parsed = DeploymentSucceeded.safeParse(event);
  if (!parsed.success) return null;
  const { target, project, deployment } = parsed.data.payload;
  const inPreviewProject = Boolean(previewProject) && (project?.id === previewProject || deployment.name === previewProject);
  const slug = deployment.meta?.lead;
  if (!inPreviewProject || target === "production" || typeof slug !== "string" || !slug) return null;
  const host = deployment.url.replace(/^https?:\/\//, "");
  return { slug, previewUrl: `https://${host}` };
}
