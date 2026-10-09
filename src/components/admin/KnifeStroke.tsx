/**
 * One swipe of a loaded palette knife: the site's motif, reused in the admin
 * as the mark for "here" and "done". Drawn in currentColor.
 */
const STROKES = [
  "M2 9.5C5 6.8 11 5.6 19 5.2c6-.3 10.6-1.5 12.6-2.4l.4 2.1c-.6 2.6-4.7 5.4-12.2 6.3-6.9.8-12.6 1.6-17.5 3.6L2 9.5Z",
  "M1.6 8.8c3.6-3.4 9.9-4.2 17.6-4.9 5.8-.5 10.5-1.6 12.7-2.5l.5 2.4c-1.2 3-5.6 5.6-13 6.4-6.4.7-11.9 1.7-17 4.1l-.8-5.5Z",
  "M2.4 10.2c2.8-3.2 8.6-4.6 16.4-5.3 6.3-.6 10.9-1.4 12.8-2.3l.3 1.9c-.3 3-4.4 5.8-12 6.7-7.2.8-12.3 1.4-17.2 3.4l-.3-4.4Z",
];

export default function KnifeStroke({ variant = 0, className = "" }: { variant?: number; className?: string }) {
  return (
    <svg viewBox="0 0 34 16" aria-hidden="true" className={className} preserveAspectRatio="none">
      <path d={STROKES[variant % STROKES.length]} fill="currentColor" />
    </svg>
  );
}
