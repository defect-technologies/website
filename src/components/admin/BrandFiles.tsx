import { Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { removeBrandFileAction } from "@/app/admin/(panel)/sites/actions";
import { MAX_BRAND_FILES } from "@/lib/brandFiles";
import type { BrandFile } from "@/server/db/schema";
import BrandFileUpload from "./BrandFileUpload";
import ConfirmRowButton from "./ConfirmRowButton";
import { InfoTip, SectionHeading, StatusMark } from "./ui";

function Tile({ file, leadId }: { file: BrandFile; leadId: string }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <a href={file.url} target="_blank" rel="noreferrer" className="bg-paper-shade/60 block aspect-square overflow-hidden rounded-xl outline-1 -outline-offset-1 outline-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element -- Blob files are already web-sized; the optimizer would need the store's host allowed. */}
        <img src={file.url} alt={file.name} loading="lazy" className="size-full object-contain p-2" />
      </a>
      <div className="relative flex min-h-10 items-center gap-1">
        <span className="text-ink-soft min-w-0 flex-1 truncate text-sm" title={file.name}>
          {file.name}
        </span>
        <ConfirmRowButton action={removeBrandFileAction.bind(null, leadId)} id={file.id} label={`Remove ${file.name}`} confirmLabel="Remove" icon={<Trash size={18} aria-hidden="true" />} />
      </div>
    </li>
  );
}

/** The owner's own artwork. Every build of their site gets these files and is told to design around them. */
export default function BrandFiles({ leadId, files, canUpload }: { leadId: string; files: BrandFile[]; canUpload: boolean }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <SectionHeading count={files.length || undefined}>Brand files</SectionHeading>
        <InfoTip>The owner&apos;s logo, signs or artwork. The next build designs around them. PNG, JPG, WebP or SVG, up to 20 MB each.</InfoTip>
      </div>
      {!canUpload && <StatusMark icon={WarningCircle} tone="warn" label="Uploads off" detail="Connect the defect-brand-files Blob store to this project with the BRAND_FILES prefix." />}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
        {files.map((file) => (
          <Tile key={file.id} file={file} leadId={leadId} />
        ))}
        {canUpload && files.length < MAX_BRAND_FILES && (
          <li>
            <BrandFileUpload leadId={leadId} />
          </li>
        )}
      </ul>
    </section>
  );
}
