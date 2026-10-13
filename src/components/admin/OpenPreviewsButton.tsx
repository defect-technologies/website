"use client";

import { ArrowSquareOut } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../Button";
import { Notice } from "./ui";

/** Opens every listed preview in its own tab. Chrome allows one tab per click until pop-ups are allowed for the site. */
export default function OpenPreviewsButton({ urls }: { urls: string[] }) {
  const [blocked, setBlocked] = useState(0);
  const openAll = () => {
    let refused = 0;
    for (const url of urls) {
      const tab = window.open(url, "_blank");
      if (tab) tab.opener = null;
      else refused += 1;
    }
    setBlocked(refused);
  };
  if (urls.length < 2) return null;
  return (
    <>
      <Button size="sm" variant="soft" className="w-fit" onClick={openAll} icon={<ArrowSquareOut size={16} aria-hidden="true" />}>
        Open {urls.length} previews
      </Button>
      {blocked > 0 && (
        <Notice tone="bad" className="w-full">
          Chrome blocked {blocked === 1 ? "1 tab" : `${blocked} tabs`}. Click the pop-up icon at the right end of the address bar, choose to always allow pop-ups from this site, then try again.
        </Notice>
      )}
    </>
  );
}
