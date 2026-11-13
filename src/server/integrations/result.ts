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

export async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(OUTSIDE_CALL_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return (await response.json()) as T;
}
