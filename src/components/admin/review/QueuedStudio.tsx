import { type BuiltDesign, builtDesignFor } from "@/server/boards/builtDesign";
import type { ReviewItem } from "@/server/review/queue";
import ReviewStudio from "./ReviewStudio";
import type { StudioActions, StudioPaths } from "./StudioContext";
import type { StudioDesign } from "./useDesignView";

type Props = { queue: ReviewItem[]; id: string | undefined; actions: StudioActions; paths: StudioPaths };

/** Only what the studio shows of the design: the rest of the option stays on the server. */
function studioDesign(design: BuiltDesign | null): StudioDesign | null {
  return design && { letter: design.letter, name: design.option.name, by: design.by, at: design.at, pictures: design.option.pictures };
}

/** The preview `id` names in a review queue (the first when it names none there), with its place in the queue. */
export default async function QueuedStudio({ queue, id, actions, paths }: Props) {
  const index = Math.max(0, queue.findIndex((item) => item.id === id));
  const item = queue[index];
  const design = studioDesign(await builtDesignFor(item.id));
  return (
    <ReviewStudio
      key={`${item.id}:${item.previewUrl}`}
      actions={actions}
      paths={paths}
      item={{ id: item.id, businessName: item.businessName, website: item.website, previewUrl: item.previewUrl, held: item.stage === "new", design }}
      position={index + 1}
      total={queue.length}
      previousId={queue[index - 1]?.id ?? null}
      nextId={queue[index + 1]?.id ?? queue.find((other) => other.id !== item.id)?.id ?? null}
    />
  );
}
