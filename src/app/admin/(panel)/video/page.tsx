import type { Metadata } from "next";
import PlayAllTakes from "@/components/admin/PlayAllTakes";
import TakeRecorder from "@/components/admin/TakeRecorder";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { VOICE_LINES, type VoiceLine } from "@/content/welcomeVideoScript";
import { founderName } from "@/lib/founders";
import { requireFounder } from "@/server/auth/session";
import { env } from "@/server/env";
import { latestVoiceTakes, type VoiceTake } from "@/server/video/voiceTakes";

export const metadata: Metadata = { title: "Welcome video" };

const savedOn = (take: VoiceTake) => take.uploadedAt.toLocaleString("en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });

function Line({ line, take, mine }: { line: VoiceLine; take: VoiceTake | undefined; mine: boolean }) {
  return (
    <Card className={`flex flex-col gap-4 p-5 sm:p-6 ${mine ? "" : "opacity-70"}`}>
      <p className="text-ink-faint text-sm">
        <span className="text-ink font-semibold">{line.speaker}</span> over {line.onScreen.charAt(0).toLowerCase() + line.onScreen.slice(1)}
      </p>
      <p className={`text-pretty ${mine ? "text-ink text-2xl leading-snug font-medium" : "text-ink-soft text-lg"}`}>{line.text}</p>
      {take && (
        <div className="flex flex-wrap items-center gap-3">
          <audio controls src={take.url} preload="none" className="h-10 max-w-full" aria-label={`${line.speaker}'s saved take`} />
          <span className="text-ink-faint text-sm">Saved {savedOn(take)}</span>
        </div>
      )}
      {mine && <TakeRecorder lineId={line.id} />}
    </Card>
  );
}

export default async function VideoPage() {
  const founder = await requireFounder();
  const speaker = founderName(founder.email);
  const takes = await latestVoiceTakes();
  const urls = VOICE_LINES.flatMap((line) => (takes[line.id] ? [takes[line.id].url] : []));
  return (
    <>
      <PageHeader title="Welcome video">
        <PlayAllTakes urls={urls} />
      </PageHeader>
      <p className="text-ink-soft max-w-[60ch] text-lg text-pretty">
        Record your lines in a quiet room, a hand&apos;s width from the mic. Saving a take replaces the last one, and Claude cuts the video from the newest takes.
      </p>
      {!env.brandFilesToken() && <Notice tone="warn">Takes can&apos;t be saved until the website has its BRAND_FILES_READ_WRITE_TOKEN.</Notice>}
      <ol className="flex flex-col gap-4">
        {VOICE_LINES.map((line) => (
          <li key={line.id}>
            <Line line={line} take={takes[line.id]} mine={line.speaker === speaker} />
          </li>
        ))}
      </ol>
    </>
  );
}
