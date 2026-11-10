"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** The parts of the Web Speech API we use. Safari and Chrome ship it as webkitSpeechRecognition. */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionClass(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

const subscribeToNothing = () => () => {};
const hasRecognition = () => recognitionClass() !== null;

/** A pause or our own stop() ends a session harmlessly; any other error means typing instead. */
const HARMLESS = new Set(["no-speech", "aborted"]);

function joinResults(event: RecognitionEvent, settled: string) {
  let final = settled;
  let interim = "";
  for (let index = event.resultIndex; index < event.results.length; index++) {
    const result = event.results[index];
    if (result.isFinal) final += `${result[0].transcript} `;
    else interim += result[0].transcript;
  }
  return { final, interim };
}

/**
 * Speech to text on the device, for as long as the founder keeps talking. Phones end a recognition session after a
 * pause, so it restarts until stop() is called.
 */
export function useDictation() {
  const supported = useSyncExternalStore(subscribeToNothing, hasRecognition, () => false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [blocked, setBlocked] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const settled = useRef("");
  const wanted = useRef(false);

  const begin = useCallback(function listen() {
    const Speech = recognitionClass();
    if (!Speech) return;
    const session = new Speech();
    session.continuous = true;
    session.interimResults = true;
    session.lang = navigator.language || "en-US";
    session.onresult = (event) => {
      const { final, interim } = joinResults(event, settled.current);
      settled.current = final;
      setText(`${final}${interim}`.trim());
    };
    session.onerror = (event) => {
      if (HARMLESS.has(event.error)) return;
      wanted.current = false;
      setBlocked(true);
    };
    session.onend = () => {
      if (wanted.current) listen();
      else setListening(false);
    };
    recognition.current = session;
    session.start();
  }, []);

  const start = useCallback(() => {
    settled.current = "";
    wanted.current = true;
    setText("");
    setBlocked(false);
    setListening(true);
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      recognition.current?.stop();
    },
    [],
  );

  return { supported, listening, text, setText, blocked, start, stop };
}
