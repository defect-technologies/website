import type { ReviewItem } from "@/server/review/queue";
import ReviewStudio from "./ReviewStudio";
import type { StudioActions, StudioPaths } from "./StudioContext";

type Props = { queue: ReviewItem[]; id: string | undefined; actions: StudioActions; paths: StudioPaths };

/** The preview `id` names in a review queue (the first when it names none there), with its place in the queue. */
export default function QueuedStudio({ queue, id, actions, paths }: Props) {
  const index = Math.max(0, queue.findIndex((item) => item.id === id));
  const item = queue[index];
  return (
    <ReviewStudio
      key={`${item.id}:${item.previewUrl}`}
      actions={actions}
      paths={paths}
      item={{ id: item.id, businessName: item.businessName, website: item.website, previewUrl: item.previewUrl, held: item.stage === "new" }}
      position={index + 1}
      total={queue.length}
      previousId={queue[index - 1]?.id ?? null}
      nextId={queue[index + 1]?.id ?? queue.find((other) => other.id !== item.id)?.id ?? null}
    />
  );
}
