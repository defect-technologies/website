import { PlugsConnected } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import type { Integration } from "@/server/integrations/result";
import { Notice } from "./ui";

/** Shows what a service returned, or which settings it still needs, or why it failed. */
export default function IntegrationPanel<T>({ result, children }: { result: Integration<T>; children: (data: T) => ReactNode }) {
  if (result.state === "ok") return <>{children(result.data)}</>;
  if (result.state === "error") return <Notice tone="bad">It answered with an error: {result.message}</Notice>;
  return (
    <div className="bg-paper-shade/60 flex items-start gap-3 rounded-xl px-4 py-3 text-sm">
      <PlugsConnected size={20} className="text-ink-faint mt-px shrink-0" aria-hidden="true" />
      <p className="text-ink-soft text-pretty">
        Not connected. Add{" "}
        {result.needs.map((need, index) => (
          <span key={need}>
            {index > 0 && (index === result.needs.length - 1 ? " and " : ", ")}
            <code className="text-ink font-mono">{need}</code>
          </span>
        ))}{" "}
        to the project&apos;s environment variables in Vercel.
      </p>
    </div>
  );
}
