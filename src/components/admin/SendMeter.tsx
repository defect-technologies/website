import KnifeStroke from "./KnifeStroke";

/** Today's sends against the daily limit, one knife stroke per email. */
export default function SendMeter({ sent, limit }: { sent: number; limit: number }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="flex items-center gap-0.5">
        {Array.from({ length: limit }, (_, index) => (
          <KnifeStroke key={index} variant={index} className={`h-3 w-5 ${index < sent ? "text-ink" : "text-ink/12"}`} />
        ))}
      </div>
      <p className="text-ink-soft text-sm tabular-nums">
        {sent} of {limit} sent today
      </p>
    </div>
  );
}
