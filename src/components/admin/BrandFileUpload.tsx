"use client";

import { CircleNotch, Plus } from "@phosphor-icons/react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useId, useState, type ChangeEvent } from "react";
import { saveBrandFileAction } from "@/app/admin/(panel)/sites/actions";
import { brandFolder, BRAND_FILE_ACCEPT, BRAND_FILE_TYPES, MAX_BRAND_FILE_BYTES } from "@/lib/brandFiles";
import { Notice } from "./ui";

type Progress = { done: number; total: number } | null;

const ACCEPTED: readonly string[] = BRAND_FILE_TYPES;

/** Why a file can't go up, before we spend an upload on it. */
function problemWith(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return `${file.name} isn't a PNG, JPG, WebP or SVG. Export it as one of those first.`;
  if (file.size > MAX_BRAND_FILE_BYTES) return `${file.name} is over 20 MB.`;
  return null;
}

async function uploadOne(leadId: string, file: File): Promise<string | null> {
  const blob = await upload(`${brandFolder(leadId)}${file.name}`, file, { access: "public", handleUploadUrl: "/api/admin/brand-files", contentType: file.type });
  const saved = await saveBrandFileAction({ leadId, url: blob.url, name: file.name, contentType: file.type as (typeof BRAND_FILE_TYPES)[number], size: file.size });
  return saved.ok ? null : saved.message;
}

/** The last tile in the grid: picks files and sends each straight to Blob, then shows them once they're saved. */
export default function BrandFileUpload({ leadId }: { leadId: string }) {
  const inputId = useId();
  const router = useRouter();
  const [progress, setProgress] = useState<Progress>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const send = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    const found: string[] = [];
    const ready = files.filter((file) => {
      const problem = problemWith(file);
      if (problem) found.push(problem);
      return !problem;
    });
    for (const [index, file] of ready.entries()) {
      setProgress({ done: index, total: ready.length });
      const problem = await uploadOne(leadId, file).catch((error: unknown) => `${file.name} didn't upload: ${error instanceof Error ? error.message : "try again"}.`);
      if (problem) found.push(problem);
    }
    setProgress(null);
    setProblems(found);
    router.refresh();
  };

  return (
    <>
      <label
        htmlFor={inputId}
        className="bg-paper-shade/60 text-ink-soft hover:bg-paper-shade hover:text-ink has-[:focus-visible]:outline-ink flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
      >
        {progress ? <CircleNotch size={24} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Plus size={24} aria-hidden="true" />}
        <span aria-live="polite">{progress ? `Uploading ${progress.done + 1} of ${progress.total}` : "Add files"}</span>
        <input id={inputId} type="file" multiple accept={BRAND_FILE_ACCEPT} onChange={send} disabled={Boolean(progress)} className="sr-only" />
      </label>
      {problems.length > 0 && (
        <Notice tone="bad" className="col-span-full">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </Notice>
      )}
    </>
  );
}
