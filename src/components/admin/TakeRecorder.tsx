"use client";

import { ArrowCounterClockwise, CircleNotch, FloppyDisk, Microphone, Stop } from "@phosphor-icons/react";
import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "../Button";
import { Notice } from "./ui";
import { MAX_VOICE_TAKE_BYTES, takePath } from "@/lib/voiceTakes";

type Phase = "idle" | "recording" | "recorded" | "saving";

/** Chrome and Firefox record WebM with Opus; Safari only MP4. */
const FORMATS = [
  { mimeType: "audio/webm;codecs=opus", type: "audio/webm", extension: "webm" },
  { mimeType: "audio/mp4", type: "audio/mp4", extension: "m4a" },
  { mimeType: "audio/webm", type: "audio/webm", extension: "webm" },
];

const formatFor = () => FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;

const seconds = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, "0")}`;

function micProblem(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "The browser blocked the microphone. Allow it for defect.tech in the browser's site settings, then press Record again.";
  if (error instanceof DOMException && error.name === "NotFoundError") return "No microphone was found. Plug one in or switch devices, then press Record again.";
  return "Unable to start recording. Reload the page and try again.";
}

/** Record a take of one line, listen back, then save it or record again. Saving replaces the line's take. */
export default function TakeRecorder({ lineId }: { lineId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<{ blob: Blob; url: string; extension: string; type: string } | null>(null);
  const [problem, setProblem] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => () => void (take && URL.revokeObjectURL(take.url)), [take]);

  const start = async () => {
    setProblem("");
    const format = formatFor();
    if (!format) return setProblem("This browser can't record audio. Try Chrome or Safari.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
      const chunks: Blob[] = [];
      const media = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: 128_000 });
      media.ondataavailable = (event) => chunks.push(event.data);
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: format.type });
        setTake({ blob, url: URL.createObjectURL(blob), extension: format.extension, type: format.type });
        setPhase("recorded");
      };
      recorder.current = media;
      media.start();
      const began = Date.now();
      setElapsed(0);
      timer.current = window.setInterval(() => setElapsed(Date.now() - began), 250);
      setPhase("recording");
    } catch (error) {
      setProblem(micProblem(error));
    }
  };

  const stop = () => {
    if (timer.current) window.clearInterval(timer.current);
    recorder.current?.stop();
  };

  const save = async () => {
    if (!take) return;
    if (take.blob.size > MAX_VOICE_TAKE_BYTES) return setProblem("That take is over 10 MB. Record a shorter one.");
    setPhase("saving");
    try {
      await upload(takePath(lineId, take.extension), take.blob, { access: "public", handleUploadUrl: "/api/admin/voice-takes", contentType: take.type });
      setTake(null);
      setPhase("idle");
      router.refresh();
    } catch (error) {
      setPhase("recorded");
      setProblem(`The take didn't save: ${error instanceof Error ? error.message : "try again"}.`);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {phase === "idle" && (
          <Button variant="solid" onClick={start} icon={<Microphone size={18} weight="fill" aria-hidden="true" />}>
            Record
          </Button>
        )}
        {phase === "recording" && (
          <>
            <Button variant="danger" onClick={stop} icon={<Stop size={18} weight="fill" aria-hidden="true" />}>
              Stop
            </Button>
            <span className="text-bad flex items-center gap-2 font-medium tabular-nums" role="status">
              <span className="bg-bad size-2.5 animate-pulse rounded-full motion-reduce:animate-none" aria-hidden="true" />
              Recording {seconds(elapsed)}
            </span>
          </>
        )}
        {(phase === "recorded" || phase === "saving") && take && (
          <>
            <audio controls src={take.url} className="h-10 max-w-full" aria-label="Your new take" />
            <Button variant="solid" onClick={save} disabled={phase === "saving"} icon={phase === "saving" ? <CircleNotch size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <FloppyDisk size={18} aria-hidden="true" />}>
              {phase === "saving" ? "Saving" : "Save take"}
            </Button>
            <Button variant="ghost" onClick={start} disabled={phase === "saving"} icon={<ArrowCounterClockwise size={18} aria-hidden="true" />}>
              Record again
            </Button>
          </>
        )}
      </div>
      {problem && <Notice tone="bad">{problem}</Notice>}
    </div>
  );
}
