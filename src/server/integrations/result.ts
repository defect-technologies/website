import "server-only";

export type Integration<T> =
  | { state: "not_configured"; needs: string[] }
  | { state: "error"; message: string }
  | { state: "ok"; data: T };

/** Runs `load` when every setting is present, and turns a missing setting or a failure into something a page can show. */
export async function integration<T>(settings: Record<string, string>, load: () => Promise<T>): Promise<Integration<T>> {
  const needs = Object.entries(settings)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (needs.length > 0) return { state: "not_configured", needs };
  try {
    return { state: "ok", data: await load() };
  } catch (error) {
    return { state: "error", message: (error as Error).message };
  }
}

/** How long an outside service gets to answer before the call is given up. */
export const OUTSIDE_CALL_TIMEOUT_MS = 15_000;

/** A read is asked again after these waits when the service says it is busy or broken. A timeout is not asked again, so a stalled service never costs three full time limits. */
const READ_RETRY_DELAYS_MS = [500, 1_500];
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(OUTSIDE_CALL_TIMEOUT_MS) });
    if (response.ok) return (await response.json()) as T;
    if (attempt < READ_RETRY_DELAYS_MS.length && RETRYABLE_STATUSES.has(response.status)) {
      await pause(READ_RETRY_DELAYS_MS[attempt]);
      continue;
    }
    throw new Error(`${new URL(url).host} answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}
