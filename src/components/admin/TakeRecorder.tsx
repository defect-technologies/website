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

/**
 * The mic exactly as it hears you. The browser's automatic gain starts quiet and turns itself up a few
 * seconds in, and its noise suppression changes the tone as it does, so a take sounded like two mics.
 * The cleanup after recording handles noise and level instead.
 */
const RAW_MIC: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 };

/** How loud the mic is right now, 0 to 1, for the meter while recording. */
function watchLevel(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(samples);
    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
    onLevel(Math.min(1, peak));
    frame = requestAnimationFrame(tick);
  };
  tick();
  return () => {
    cancelAnimationFrame(frame);
    void context.close();
  };
}

/** Green while you're loud enough, amber when quiet, red when it's about to distort. */
function LevelMeter({ level }: { level: number }) {
  const tone = level > 0.95 ? "bg-bad" : level > 0.2 ? "bg-good" : "bg-warn";
  return (
    <span className="bg-paper-shade relative h-2 w-32 overflow-hidden rounded-full" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
      <span className={`absolute inset-y-0 left-0 ${tone}`} style={{ width: `${Math.round(level * 100)}%` }} />
    </span>
  );
}

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
  const [level, setLevel] = useState(0);
  const stopMeter = useRef<(() => void) | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    stopMeter.current?.();
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => () => void (take && URL.revokeObjectURL(take.url)), [take]);

  const start = async () => {
    setProblem("");
    const format = formatFor();
    if (!format) return setProblem("This browser can't record audio. Try Chrome or Safari.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: RAW_MIC });
      stopMeter.current = watchLevel(stream, setLevel);
      const chunks: Blob[] = [];
      const media = new MediaRecorder(stream, { mimeType: format.mimeType, audioBitsPerSecond: 128_000 });
      media.ondataavailable = (event) => chunks.push(event.data);
      media.onstop = () => {
        stopMeter.current?.();
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
            <LevelMeter level={level} />
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
