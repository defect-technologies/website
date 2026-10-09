import { useSyncExternalStore } from "react";

const STILLNESS = "(prefers-reduced-motion: reduce)";

function watchStillness(onChange: () => void) {
  const query = window.matchMedia(STILLNESS);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** False on the server and whenever the reader asks for less motion. */
export function useMotionAllowed() {
  return useSyncExternalStore(
    watchStillness,
    () => !window.matchMedia(STILLNESS).matches,
    () => false,
  );
}
