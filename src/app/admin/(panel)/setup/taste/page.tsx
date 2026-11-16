import { requireFounder } from "@/server/auth/session";
import { Archive, ArrowCounterClockwise, CaretRight, FloppyDisk, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { addTasteLessonAction, restoreTasteLessonAction, retireTasteLessonAction, updateTasteLessonAction } from "@/app/admin/(panel)/review/studioActions";
import EmptyState from "@/components/admin/EmptyState";
import { TextAreaField } from "@/components/admin/fields";
import PageTabs from "@/components/admin/PageTabs";
import SubmitButton from "@/components/admin/SubmitButton";
import { Card, PageHeader, Section, When } from "@/components/admin/ui";
import { FOUNDERS } from "@/lib/founders";
import { MAX_NOTE_TEXT } from "@/lib/review";
import type { TasteLesson } from "@/server/db/schema";
import { notesBy, type FounderNote } from "@/server/review/founderNotes";
import { activeTasteLessons, retiredTasteLessons } from "@/server/review/taste";

export const metadata: Metadata = { title: "Taste" };

type FounderTab = (typeof FOUNDERS)[number];

function ReadOnlyLesson({ lesson, number }: { lesson: TasteLesson; number: number }) {
  return (
    <li className="flex items-baseline gap-4 px-5 py-4">
      <span className="font-semibold tabular-nums">{number}</span>
      <p className="flex-1 text-pretty">{lesson.text}</p>
      <span className="text-ink-faint shrink-0 text-sm">
        <When date={lesson.createdAt} />
      </span>
    </li>
  );
}

function Lesson({ lesson, number }: { lesson: TasteLesson; number: number }) {
  return (
    <li>
      <form action={updateTasteLessonAction} className="flex flex-col gap-3 px-5 py-4">
        <input type="hidden" name="id" value={lesson.id} />
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold tabular-nums">{number}</span>
          <span className="text-ink-faint text-sm">
            <When date={lesson.createdAt} />
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

function AddLesson() {
  return (
    <form action={addTasteLessonAction} className="flex max-w-prose flex-col gap-3">
      <TextAreaField label="New lesson" name="text" id="new-lesson" rows={2} required maxLength={MAX_NOTE_TEXT} placeholder="Never set the phone number in a pill button." />
      <SubmitButton className="w-fit" icon={<Plus size={18} aria-hidden="true" />}>
        Add lesson
      </SubmitButton>
    </form>
  );
}

/** A founder's standing rules. Only the founder who wrote them edits them; the other reads them. */
function Lessons({ lessons, retired, founder, own }: { lessons: TasteLesson[]; retired: TasteLesson[]; founder: FounderTab; own: boolean }) {
  const Row = own ? Lesson : ReadOnlyLesson;
  return (
    <Section title="Lessons" count={lessons.length}>
      {lessons.length ? (
        <Card>
          <ol className="divide-ink/8 divide-y">
            {lessons.map((lesson, index) => (
              <Row key={lesson.id} lesson={lesson} number={index + 1} />
            ))}
          </ol>
        </Card>
      ) : (
        <EmptyState title={own ? "You have no lessons yet" : `${founder.name} has no lessons yet`}>Every build follows these, and a lesson outranks the kit&rsquo;s design rules.</EmptyState>
      )}
      {own && <AddLesson />}
      {own && <Retired lessons={retired} />}
    </Section>
  );
}

function Note({ note }: { note: FounderNote }) {
  return (
    <li className="flex flex-col gap-1.5 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link href={note.href} className="focus-visible:outline-ink font-semibold hover:underline focus-visible:outline-2">
          {note.business}
        </Link>
        <span className="text-ink-faint text-sm">
          {note.about}, <When date={note.at} />
        </span>
      </div>
      <p className="max-w-prose text-pretty whitespace-pre-line">{note.text}</p>
    </li>
  );
}

/** Everything the founder wrote while judging designs and previews, kept so patterns in their taste can be found later. */
function Notes({ notes, founder }: { notes: FounderNote[]; founder: FounderTab }) {
  return (
    <Section title="Notes" count={notes.length}>
      {notes.length ? (
        <Card>
          <ul className="divide-ink/8 divide-y">
            {notes.map((note) => (
              <Note key={note.id} note={note} />
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title={`No notes from ${founder.name} yet`}>What {founder.name} writes when choosing a design or sending a preview back lands here.</EmptyState>
      )}
    </Section>
  );
}

/** Each founder's taste kept apart: their standing lessons, then every note they have written about designs and previews. */
export default async function TastePage({ searchParams }: { searchParams: Promise<{ founder?: string }> }) {
  const me = await requireFounder();
  const asked = (await searchParams).founder;
  const founder = FOUNDERS.find((entry) => entry.name === asked) ?? FOUNDERS.find((entry) => entry.email === me.email) ?? FOUNDERS[0];
  const own = founder.email === me.email;
  const [lessons, retired, notes] = await Promise.all([activeTasteLessons(), retiredTasteLessons(), notesBy(founder.email)]);
  const theirs = (list: TasteLesson[]) => list.filter((lesson) => lesson.createdBy === founder.email);
  const tabs = FOUNDERS.map((entry) => ({ href: `/admin/setup/taste?founder=${entry.name}`, label: entry.name }));
  return (
    <>
      <PageHeader title="Taste" />
      <PageTabs label="Whose taste" tabs={tabs} current={`/admin/setup/taste?founder=${founder.name}`} />
      <Lessons lessons={theirs(lessons)} retired={theirs(retired)} founder={founder} own={own} />
      <Notes notes={notes} founder={founder} />
    </>
  );
}
