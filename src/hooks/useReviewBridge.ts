"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { NoteAnchor } from "@/lib/review";
import { readSections, type ReviewSection, SECTIONS_PROTOCOL } from "@/lib/reviewSections";

const SOURCE = "defect-review";
/**
 * The bridge starts when the preview's React hydrates, which can be after the frame's load event, so hello repeats until
 * it answers. A preview built before the bridge never answers; after the last try the page offers whole-page notes.
 */
const HELLO_INTERVAL_MS = 400;
const HELLO_TRIES = 20;

export type BridgeState = "connecting" | "connected" | "unavailable";

type BridgeMessage =
  | { type: "ready" | "navigate"; path: string; version?: number }
  | ({ type: "picked" } & NoteAnchor)
  | { type: "pick-cancelled" }
  | { type: "sections"; path: string; scrollY?: number; sections?: unknown };

/** The sections of the page the frame is on, and how far down it was scrolled when it reported them. */
export type PageSections = { path: string; scrollY: number; sections: ReviewSection[] };

const NO_SECTIONS: PageSections = { path: "", scrollY: 0, sections: [] };

function bridgeMessage(event: MessageEvent, origin: string): BridgeMessage | null {
  if (event.origin !== origin) return null;
  const data = event.data as { source?: string; type?: string } | null;
  if (!data || data.source !== SOURCE || typeof data.type !== "string") return null;
  return data as BridgeMessage;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

type Handlers = { onPicked: (anchor: NoteAnchor) => void; onPickCancelled: () => void };

/**
 * Talks to the review bridge site-kit puts in every preview: which page the frame is on, and the element the founder
 * clicks while pointing. The frame is on another origin, so this is the only way in.
 */
export function useReviewBridge(frame: RefObject<HTMLIFrameElement | null>, previewUrl: string, { onPicked, onPickCancelled }: Handlers) {
  const origin = originOf(previewUrl);
  const [state, setState] = useState<BridgeState>("connecting");
  const [path, setPath] = useState("/");
  const [version, setVersion] = useState(1);
  const [pageSections, setPageSections] = useState<PageSections>(NO_SECTIONS);
  const handlers = useRef({ onPicked, onPickCancelled });
  const answered = useRef(false);
  const greeting = useRef(0);
  const tries = useRef(0);
  useEffect(() => {
    handlers.current = { onPicked, onPickCancelled };
  });

  const post = useCallback((message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ source: SOURCE, ...message }, origin), [frame, origin]);

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      const message = bridgeMessage(event, origin);
      if (!message) return;
      if (message.type === "ready" || message.type === "navigate") {
        answered.current = true;
        setState("connected");
        setPath(message.path || "/");
        if (message.type === "ready") setVersion(typeof message.version === "number" ? message.version : 1);
      } else if (message.type === "sections") {
        setPageSections({ path: message.path || "/", scrollY: typeof message.scrollY === "number" ? message.scrollY : 0, sections: readSections(message.sections) });
      } else if (message.type === "picked") {
        handlers.current.onPicked({ path: message.path, selector: message.selector, tag: message.tag, text: message.text });
      } else {
        handlers.current.onPickCancelled();
      }
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [origin]);

  useEffect(() => () => window.clearInterval(greeting.current), []);

  /** Called on every frame load: a full page load inside the frame starts a fresh bridge that needs a new hello. */
  const greet = useCallback(() => {
    answered.current = false;
    window.clearInterval(greeting.current);
    tries.current = 0;
    const sayHello = () => {
      if (answered.current) return window.clearInterval(greeting.current);
      if (tries.current++ >= HELLO_TRIES) {
        window.clearInterval(greeting.current);
        return setState("unavailable");
      }
      post({ type: "hello" });
    };
    sayHello();
    greeting.current = window.setInterval(sayHello, HELLO_INTERVAL_MS);
  }, [post]);

  const setPicking = useCallback((on: boolean) => post({ type: "pick", on }), [post]);
  /**
   * Asks the preview to go to a page, scroll to an element, outline it and pin the question beside it. Previews built
   * before kit 0.11.7 ignore it; 0.11.7 outlines without the question. `block: "start"` shows a section from its top
   * (kit 0.15.1); an older preview puts it in the middle of the screen.
   */
  const show = useCallback(
    (target: { path: string; selector: string; question: string; block?: "start" | "center" }) => post({ type: "show", path: target.path, selector: target.selector, label: target.question, block: target.block ?? "center" }),
    [post],
  );
  /** Asks the preview for the sections of the page it is on. It answers from kit 0.15.1. */
  const requestSections = useCallback(() => post({ type: "sections" }), [post]);

  return { state, path, greet, setPicking, show, requestSections, pageSections, reportsSections: version >= SECTIONS_PROTOCOL };
}
