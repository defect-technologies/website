import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

/** False during server rendering and hydration, true from the first client render after. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}
