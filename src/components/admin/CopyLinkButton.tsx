"use client";

import { Check, Link } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../Button";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        onClick={copy}
        aria-label="Copy link"
        title={copied ? "Copied" : "Copy link"}
        icon={copied ? <Check size={18} weight="bold" aria-hidden="true" /> : <Link size={18} aria-hidden="true" />}
      />
      <span role="status" className="sr-only">
        {copied ? "Link copied to the clipboard" : ""}
      </span>
    </>
  );
}
