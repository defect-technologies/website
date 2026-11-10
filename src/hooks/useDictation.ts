"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noSubscription = () => () => {};

function splitResults(event: RecognitionEvent): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let index = event.resultIndex; index < event.results.length; index++) {
    const result = event.results[index];
    if (result.isFinal) final += result[0].transcript;
    else interim += result[0].transcript;
  }
  return { final, interim };
}

/** Errors that mean the microphone can't be used at all, so listening stops instead of restarting. */
const FATAL_ERRORS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);

/**
 * The browser's own speech recognition, kept listening until it's turned off: Chrome ends a session after a pause,
 * so it restarts while the founder still wants it on. Each finished phrase goes to onPhrase.
 */
export function useDictation(onPhrase: (text: string) => void) {
  const supported = useSyncExternalStore(noSubscription, () => recognitionConstructor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const phrase = useRef(onPhrase);
  useEffect(() => {
    phrase.current = onPhrase;
  });

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    const session = new Constructor();
    session.continuous = true;
    session.interimResults = true;
    session.lang = "en-US";
    session.onresult = (event) => {
      const { final, interim: partial } = splitResults(event);
      if (final.trim()) phrase.current(final.trim());
      setInterim(partial);
    };
    session.onerror = (event) => {
      if (!FATAL_ERRORS.has(event.error)) return;
      setError("The browser won't let this page use the microphone. Allow it in the address bar, then try again.");
      stop();
    };
    session.onend = () => {
      if (wanted.current) session.start();
    };
    recognition.current = session;
    wanted.current = true;
    setError("");
    setListening(true);
    session.start();
  }, [stop]);

  useEffect(() => stop, [stop]);

  const toggle = useCallback(() => (wanted.current ? stop() : start()), [start, stop]);

  return { supported, listening, interim, error, toggle, stop };
}
