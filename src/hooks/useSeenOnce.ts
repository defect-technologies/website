import { useEffect, useState, type RefObject } from "react";

/** Turns true the first time the element is mostly on screen, and stays true. */
export function useSeenOnce(target: RefObject<Element | null>, enabled: boolean, threshold = 0.45) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const element = target.current;
    if (!enabled || !element || seen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [target, enabled, seen, threshold]);

  return seen;
}
