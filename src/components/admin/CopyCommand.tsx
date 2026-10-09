"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../Button";

export default function CopyCommand({ command, label = "Copy command" }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="flex flex-col gap-2">
      <pre className="bg-ink text-paper overflow-x-auto rounded-xl p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">{command}</pre>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={copy} icon={copied ? <Check size={16} weight="bold" aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>
          {copied ? "Copied" : label}
        </Button>
        <span role="status" className="sr-only">
          {copied ? "Copied to the clipboard" : ""}
        </span>
      </div>
    </div>
  );
}
