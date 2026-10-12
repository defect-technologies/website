"use client";

import { Play, Stop } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../Button";

/** Plays every saved take in script order, so you hear the voiceover as one piece. */
export default function PlayAllTakes({ urls }: { urls: string[] }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  const playFrom = (index: number) => {
    if (index >= urls.length) return setPlaying(null);
    audio.current?.pause();
    const next = new Audio(urls[index]);
    next.onended = () => playFrom(index + 1);
    audio.current = next;
    setPlaying(index);
    void next.play().catch(() => setPlaying(null));
  };

  const stop = () => {
    audio.current?.pause();
    setPlaying(null);
  };

  if (urls.length === 0) return null;
  return playing === null ? (
    <Button variant="soft" size="sm" onClick={() => playFrom(0)} icon={<Play size={16} weight="fill" aria-hidden="true" />}>
      Play all takes
    </Button>
  ) : (
    <Button variant="soft" size="sm" onClick={stop} icon={<Stop size={16} weight="fill" aria-hidden="true" />}>
      Stop ({playing + 1} of {urls.length})
    </Button>
  );
}
