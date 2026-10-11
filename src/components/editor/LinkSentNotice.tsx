import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";

export default function LinkSentNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="bg-surface shadow-card flex w-full flex-col items-center gap-3 rounded-2xl px-6 py-8 text-center">
      <EnvelopeSimple size={32} className="text-ink" aria-hidden="true" />
      <p className="text-lg font-semibold text-balance">Check your email</p>
      <p className="text-ink-soft text-pretty">{children}</p>
    </div>
  );
}
