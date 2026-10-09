import "server-only";
import { env } from "../env";
import { getJson, integration } from "./result";

export type CheckStatus = "new" | "up" | "grace" | "down" | "paused";

type Check = { name: string; status: CheckStatus; last_ping: string | null; next_ping: string | null; unique_key?: string };

export type HealthCheck = { key: string; name: string; status: CheckStatus; lastPing: Date | null };

/** Every check on the Healthchecks.io account, worst first. A read-only API key is enough. */
export function healthChecks() {
  return integration({ HEALTHCHECKS_API_KEY: env.healthchecksKey() }, async () => {
    const { checks } = await getJson<{ checks: Check[] }>("https://healthchecks.io/api/v3/checks/", {
      "X-Api-Key": env.healthchecksKey(),
    });
    const order: CheckStatus[] = ["down", "grace", "new", "paused", "up"];
    return checks
      .map((check): HealthCheck => ({
        key: check.unique_key ?? check.name,
        name: check.name,
        status: check.status,
        lastPing: check.last_ping ? new Date(check.last_ping) : null,
      }))
      .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  });
}
