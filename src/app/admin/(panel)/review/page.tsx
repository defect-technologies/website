import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import EmptyState from "@/components/admin/EmptyState";
import ReviewStudio from "@/components/admin/review/ReviewStudio";
import { pointingUpdatesUnderway, queuePointingUpdates } from "@/server/review/pointingUpdates";
import { reviewQueue } from "@/server/review/queue";

export const metadata: Metadata = { title: "Review" };

/** One preview at a time: point at what's wrong, say it, and send it all back to the builder in one go. */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  await queuePointingUpdates();
  const queue = await reviewQueue();
  if (!queue.length) {
    const updating = await pointingUpdatesUnderway();
    if (updating) {
      return (
        <EmptyState title={`Updating ${updating} ${updating === 1 ? "preview" : "previews"}`} action={<ButtonLink href="/admin/builds" variant="soft" icon={<CheckCircle size={18} aria-hidden="true" />}>See what&rsquo;s building</ButtonLink>}>
          Each comes back here as it finishes, and its questions take you to the part they ask about.
        </EmptyState>
      );
    }
    return (
      <EmptyState title="Every preview has been reviewed" action={<ButtonLink href="/admin/builds" variant="soft" icon={<CheckCircle size={18} aria-hidden="true" />}>See what&rsquo;s building</ButtonLink>}>
        New previews land here as the runner finishes them.
      </EmptyState>
    );
  }
  const index = Math.max(0, queue.findIndex((item) => item.id === id));
  const item = queue[index];
  return (
    <ReviewStudio
      key={`${item.id}:${item.previewUrl}`}
      item={{ id: item.id, businessName: item.businessName, website: item.website, previewUrl: item.previewUrl, held: item.stage === "new" }}
      position={index + 1}
      total={queue.length}
      previousId={queue[index - 1]?.id ?? null}
      nextId={queue[index + 1]?.id ?? queue.find((other) => other.id !== item.id)?.id ?? null}
    />
  );
}
