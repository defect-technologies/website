"use client";

import { Check, ClipboardText } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../Button";

/** Copies a ready-made prompt that tells Claude Code what's broken, so nobody has to read the logs. */
export default function CopyFixButton({ prompt, primary }: { prompt: string; primary: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <Button
        variant={primary ? "solid" : "soft"}
        size="sm"
        onClick={copy}
        icon={copied ? <Check size={16} weight="bold" aria-hidden="true" /> : <ClipboardText size={16} aria-hidden="true" />}
      >
        {copied ? "Copied" : "Copy fix for Claude"}
      </Button>
      <span role="status" className="sr-only">
        {copied ? "Fix prompt copied. Paste it into Claude Code." : ""}
      </span>
    </>
  );
}
