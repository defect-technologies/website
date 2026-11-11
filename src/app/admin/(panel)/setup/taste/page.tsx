import { requireFounder } from "@/server/auth/session";
import { Archive, ArrowCounterClockwise, CaretRight, FloppyDisk, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { addTasteLessonAction, restoreTasteLessonAction, retireTasteLessonAction, updateTasteLessonAction } from "@/app/admin/(panel)/review/studioActions";
import EmptyState from "@/components/admin/EmptyState";
import { TextAreaField } from "@/components/admin/fields";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, When } from "@/components/admin/ui";
import { founderName } from "@/lib/founders";
import { MAX_NOTE_TEXT } from "@/lib/review";
import type { TasteLesson } from "@/server/db/schema";
import { activeTasteLessons, retiredTasteLessons } from "@/server/review/taste";

export const metadata: Metadata = { title: "Taste lessons" };

function Lesson({ lesson, number }: { lesson: TasteLesson; number: number }) {
  return (
    <li>
      <form action={updateTasteLessonAction} className="flex flex-col gap-3 px-5 py-4">
        <input type="hidden" name="id" value={lesson.id} />
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold tabular-nums">{number}</span>
          <span className="text-ink-faint text-sm">
            {founderName(lesson.createdBy)}, <When date={lesson.createdAt} />
          </span>
        </div>
        <label htmlFor={`lesson-${lesson.id}`} className="sr-only">
          Lesson {number}
        </label>
        <textarea
          id={`lesson-${lesson.id}`}
          name="text"
          defaultValue={lesson.text}
          required
          maxLength={MAX_NOTE_TEXT}
          className="hover:bg-paper-shade/60 focus-visible:bg-surface focus-visible:outline-ink/20 -mx-2 field-sizing-content resize-none rounded-lg px-2 py-1 text-base text-pretty focus-visible:outline-2"
        />
        <div className="flex gap-2">
          <SubmitButton size="sm" variant="ghost" icon={<FloppyDisk size={16} aria-hidden="true" />}>
            Save
          </SubmitButton>
          <SubmitButton size="sm" variant="ghost" formAction={retireTasteLessonAction} formNoValidate icon={<Archive size={16} aria-hidden="true" />}>
            Retire
          </SubmitButton>
        </div>
      </form>
    </li>
  );
}

function Retired({ lessons }: { lessons: TasteLesson[] }) {
  if (!lessons.length) return null;
  return (
    <details className="group/retired">
      <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1 text-sm [&::-webkit-details-marker]:hidden">
        <CaretRight size={14} className="transition-transform duration-150 group-open/retired:rotate-90" aria-hidden="true" />
        Retired <span className="tabular-nums">{lessons.length}</span>
      </summary>
      <ul className="mt-3 flex max-w-prose flex-col gap-3">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="flex items-start justify-between gap-4">
            <p className="text-ink-soft text-pretty">{lesson.text}</p>
            <form action={restoreTasteLessonAction}>
              <input type="hidden" name="id" value={lesson.id} />
              <SubmitButton size="sm" variant="ghost" icon={<ArrowCounterClockwise size={16} aria-hidden="true" />}>
                Restore
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The founders' standing rules of taste. Every preview build, and the outside reviewer, must follow each one. */
export default async function TasteLessonsPage() {
  await requireFounder();
  const [lessons, retired] = await Promise.all([activeTasteLessons(), retiredTasteLessons()]);
  return (
    <>
      <PageHeader title="Taste lessons" />
      <p className="text-ink-soft max-w-prose text-pretty">Every build and the outside review follow these. A lesson outranks the kit&rsquo;s design rules where the two disagree. Notes marked Every site on the Review page land here.</p>
      {lessons.length ? (
        <Card>
          <ol className="divide-ink/8 divide-y">
            {lessons.map((lesson, index) => (
              <Lesson key={lesson.id} lesson={lesson} number={index + 1} />
            ))}
          </ol>
        </Card>
      ) : (
        <EmptyState title="No lessons yet">Mark a note Every site while you review a preview, or write one below.</EmptyState>
      )}
      <form action={addTasteLessonAction} className="flex max-w-prose flex-col gap-3">
        <TextAreaField label="New lesson" name="text" id="new-lesson" rows={2} required maxLength={MAX_NOTE_TEXT} placeholder="Never set the phone number in a pill button." />
        <SubmitButton className="w-fit" icon={<Plus size={18} aria-hidden="true" />}>
          Add lesson
        </SubmitButton>
      </form>
      <Retired lessons={retired} />
    </>
  );
}
