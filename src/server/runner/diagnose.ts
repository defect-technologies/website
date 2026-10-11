import "server-only";
import type { JobKind } from "@/lib/previewJobs";
import type { Fixer } from "@/lib/flags";

type Cause = { pattern: RegExp; cause: string; step: string; fixer: Fixer };

const RETRY: Record<JobKind, string> = { launch: "press Retry launch", preview: "press Rebuild preview" };

/** Failures we've seen before, in plain words, with who fixes them. Anything else goes to Claude. */
const KNOWN: Cause[] = [
  {
    pattern: /couldn't be (?:cloned|downloaded) from GitHub|could not read Username for 'https:\/\/github\.com'/i,
    cause: "The build computer can't download the site from GitHub.",
    step: "Boris: add GITHUB_READ_TOKEN to /etc/defect-runner.env (a GitHub fine-grained token for defect-technologies, all repositories, Contents read-only), restart the runner, then",
    fixer: "boris",
  },
  {
    pattern: /set (?:CLIENT_DB_ADMIN_URL|VERCEL_TOKEN|VERCEL_ORG_ID)\b/,
    cause: "The build computer is missing a setting.",
    step: "Boris: add the setting named in the details to /etc/defect-runner.env, restart the runner, then",
    fixer: "boris",
  },
  {
    pattern: /Verification failed/i,
    cause: "The new site failed its quality checks twice.",
    step: "Copy the fix prompt into Claude Code, or",
    fixer: "claude",
  },
];

const FALLBACK: Omit<Cause, "pattern"> = { cause: "The build computer hit an error.", step: "Copy the fix prompt into Claude Code, or", fixer: "claude" };

/** The lines that say what went wrong: failed checks and errors, or the last dozen lines when none stand out. */
export function failureLines(log: string): string {
  const lines = log.trim().split("\n");
  const telling = lines.filter((line) => /^\s*(?:fail|warn)\b|\b(?:error|fatal|not found|denied|couldn't|can't)\b/i.test(line));
  return (telling.length ? telling.slice(-12) : lines.slice(-12)).join("\n");
}

export function diagnose(log: string, kind: JobKind): { ask: string; fixer: Fixer } {
  const known = KNOWN.find(({ pattern }) => pattern.test(log)) ?? FALLBACK;
  return { ask: `${known.cause} ${known.step} ${RETRY[kind]}.`, fixer: known.fixer };
}
