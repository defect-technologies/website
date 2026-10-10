/** Something is running right now: a vermilion dot with a slow glow, held still when motion is reduced. */
export default function WorkingDot() {
  return (
    <span className="relative flex size-2.5" aria-hidden="true">
      <span className="bg-vermilion/50 absolute inset-0 rounded-full motion-safe:animate-ping" />
      <span className="bg-vermilion relative size-2.5 rounded-full" />
    </span>
  );
}
